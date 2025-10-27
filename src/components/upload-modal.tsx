"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import UploadDropzone from "@/components/upload-dropzone";

type UploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
};

const UploadModal = ({
  isOpen,
  onClose,
  onUploadSuccess,
}: UploadModalProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formDataFromForm = new FormData(form);
    const name = String(formDataFromForm.get("name") || "").trim();

    if (!selectedFile) {
      setError("Please select an image to upload.");
      return;
    }

    const data = new FormData();
    if (name) data.append("name", name);
    data.append("file", selectedFile);

    setIsUploading(true);
    setError(null);

    try {
      const resp = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Upload failed: ${resp.status} ${text}`);
      }

      form.reset();
      setSelectedFile(null);
      onUploadSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload New Item">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <input
          name="name"
          placeholder="Item name (optional)"
          className="h-12 rounded-lg border border-gray-ddd px-4 text-sm outline-none transition focus:border-gray-aaa"
        />
        <UploadDropzone
          selectedFile={selectedFile}
          onFileSelected={setSelectedFile}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isUploading}
          className="h-12 rounded-lg bg-p1 font-medium text-white transition hover:bg-p2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isUploading ? "Uploading..." : "Upload item"}
        </button>
      </form>
    </Modal>
  );
};

export default UploadModal;

