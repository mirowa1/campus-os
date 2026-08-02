declare module "html-to-docx" {
  type DocumentOptions = {
    orientation?: "portrait" | "landscape";
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    title?: string;
    creator?: string;
    keywords?: string[];
    description?: string;
    lastModifiedBy?: string;
    pageNumber?: boolean;
  };

  export default function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: DocumentOptions,
    footerHTMLString?: string | null
  ): Promise<Buffer | ArrayBuffer | Blob>;
}
