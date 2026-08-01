import { createClient } from "@/lib/supabase/server";
import type { ClassRow } from "@/lib/types";

export async function requireOwnedClass(classId: string): Promise<{
  userId: string;
  classRow: ClassRow;
  supabase: ReturnType<typeof createClient>;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const { data: classRow, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("user_id", user.id)
    .single();

  if (error || !classRow) {
    throw Object.assign(new Error("Class not found"), { status: 404 });
  }

  return { userId: user.id, classRow: classRow as ClassRow, supabase };
}
