"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

type UploadDropzoneProps = {
  selectedFile: File | null;
  onFileSelected: (file: File) => void;
};

export default function UploadDropzone({
  selectedFile,
  onFileSelected,
}: UploadDropzoneProps) {
  const [error, setError] = useState<string>("");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError("");
      const first = acceptedFiles[0];
      if (first) onFileSelected(first);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    onError: () => setError("There was an error, please try again."),
    onDropRejected: (rejections) => {
      const msg =
        rejections?.[0]?.errors?.[0]?.message || "File type not supported.";
      setError(msg);
    },
    noClick: true,
  });

  return (
    <div
      className={`w-full rounded-xl border border-dashed ${
        isDragActive ? "border-gray-400" : "border-gray-300"
      } bg-white`}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M9 12.75a.75.75 0 0 0 1.5 0V9.56l.72.72a.75.75 0 1 0 1.06-1.06l-2.25-2.25a.75.75 0 0 0-1.06 0L6.72 9.22a.75.75 0 1 0 1.06 1.06l.72-.72v3.19Z" />
            <path
              fillRule="evenodd"
              d="M7.5 19.5A4.5 4.5 0 0 1 3 15c0-2.1 1.44-3.87 3.39-4.36a6 6 0 0 1 11.7-.64A4.5 4.5 0 1 1 18 19.5H7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <p className="text-sm text-gray-700">
          {isDragActive ? "Drop the image here" : "Drag & drop an image here"}
        </p>
        <button
          type="button"
          onClick={open}
          className="mt-1 rounded-xl bg-p1 px-4 py-2 text-sm font-medium text-white hover:bg-p2"
        >
          Choose file
        </button>
        {selectedFile && (
          <p className="text-xs text-gray-500">Selected: {selectedFile.name}</p>
        )}
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
}
