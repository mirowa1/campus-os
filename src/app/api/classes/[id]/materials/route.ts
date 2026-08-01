import { NextRequest, NextResponse } from "next/server";
import { requireOwnedClass } from "@/lib/class-access";
import { validateMaterialUpload, MAX_MATERIAL_BYTES } from "@/lib/materials";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { userId, supabase } = await requireOwnedClass(params.id);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const validation = validateMaterialUpload({
      fileName: file.name,
      mimeType: file.type || "",
      size: file.size,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Re-check size after read (clients can lie about File.size)
    if (buffer.byteLength > MAX_MATERIAL_BYTES) {
      return NextResponse.json(
        {
          error: `File too large. Max size is ${MAX_MATERIAL_BYTES / (1024 * 1024)} MB.`,
        },
        { status: 400 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${params.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("materials")
      .upload(storagePath, buffer, {
        contentType: validation.mimeType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: material, error: insertError } = await supabase
      .from("course_materials")
      .insert({
        class_id: params.id,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: validation.mimeType,
      })
      .select()
      .single();

    if (insertError || !material) {
      await supabase.storage.from("materials").remove([storagePath]);
      return NextResponse.json(
        { error: insertError?.message || "Failed to save material" },
        { status: 500 }
      );
    }

    return NextResponse.json({ material });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { supabase } = await requireOwnedClass(params.id);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing material id" }, { status: 400 });
    }

    const { data: material, error: findError } = await supabase
      .from("course_materials")
      .select("*")
      .eq("id", id)
      .eq("class_id", params.id)
      .single();

    if (findError || !material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    await supabase.storage.from("materials").remove([material.storage_path]);
    const { error: delError } = await supabase
      .from("course_materials")
      .delete()
      .eq("id", id)
      .eq("class_id", params.id);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status });
  }
}
