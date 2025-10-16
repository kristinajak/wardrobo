"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

type UploadDropzoneProps = {
  selectedFile: File | null;
  onFileSelected: (file: File) => void;
};

const UploadDropzone = ({
  selectedFile,
  onFileSelected,
}: UploadDropzoneProps) => {
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
      className={`w-full rounded-lg border border-dashed ${
        isDragActive ? "border-gray-aaa" : "border-gray-ddd"
      } bg-white`}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center text-gray-aaa">
        <UploadIcon />
        <p className="text-gray-666">
          {isDragActive ? "Drop the image here" : "Drag & drop an image here"}
        </p>
        <button
          type="button"
          onClick={open}
          className="mt-1 rounded-lg bg-p1 px-4 py-2 font-medium text-white hover:bg-p2"
        >
          Choose file
        </button>
        {selectedFile && (
          <p className="text-xs text-gray-666">Selected: {selectedFile.name}</p>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
};

const UploadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="62"
    height="62"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 13v8" />
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="m8 17 4-4 4 4" />
  </svg>
);

export default UploadDropzone;
