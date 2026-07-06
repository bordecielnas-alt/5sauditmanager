import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addPhoto, updatePhotoComment, deletePhoto, ensureResponse } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

export type PhotoItem = {
  id: string;
  response_id: string;
  file_path: string;
  comment: string | null;
};

export function PhotoUploader({
  auditId,
  questionId,
  criteriaId,
  responseId,
  photos,
  defaultComment,
  onChanged,
}: {
  auditId: string;
  questionId: string;
  criteriaId: string;
  responseId: string | undefined;
  photos: PhotoItem[];
  defaultComment?: string;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const addPhotoFn = useServerFn(addPhoto);
  const ensureFn = useServerFn(ensureResponse);
  const updateCommentFn = useServerFn(updatePhotoComment);
  const deleteFn = useServerFn(deletePhoto);

  const doUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      let rid = responseId;
      if (!rid) {
        const r = await ensureFn({ data: { audit_id: auditId, question_id: questionId, criteria_id: criteriaId } });
        rid = r.id;
      }
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        if (!res.ok) throw new Error("upload failed");
        const { filename } = await res.json();
        await addPhotoFn({ data: { response_id: rid, file_path: filename, comment: defaultComment } });
      }
      toast.success(`${files.length} photo(s) ajoutée(s)`);
      onChanged();
      qc.invalidateQueries();
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { onChanged(); qc.invalidateQueries(); },
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative group border rounded overflow-hidden w-32">
            <img src={`/api/uploads/${p.file_path}`} alt="" className="w-full h-24 object-cover" />
            <button
              onClick={() => del.mutate(p.id)}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition"
              type="button"
              aria-label="Supprimer"
            >
              <X className="h-3 w-3" />
            </button>
            <Input
              defaultValue={p.comment ?? ""}
              placeholder="Commentaire…"
              className="h-7 text-xs rounded-none border-0 border-t"
              onBlur={(e) => {
                if (e.target.value !== (p.comment ?? "")) updateCommentFn({ data: { id: p.id, comment: e.target.value } });
              }}
            />
          </div>
        ))}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => doUpload(e.target.files)}
        />
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Camera className="h-4 w-4 mr-1" />
          {uploading ? "Envoi…" : "Ajouter des photos"}
        </Button>
      </div>
    </div>
  );
}
