"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadModal from "@/components/upload-modal";

export const Header = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const router = useRouter();

  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    setTimeout(() => {
      router.refresh();
      window.dispatchEvent(new CustomEvent("wardrobo:upload-success"));
    }, 300);
  };

  return (
    <>
      <header className="bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="relative h-10 w-40 overflow-hidden sm:h-12 sm:w-48 md:h-14 md:w-56 transition-opacity hover:opacity-80"
          >
            <Image
              src="/images/logo.png"
              alt="Wardrobo logo"
              fill
              sizes="(min-width: 768px) 14rem, (min-width: 640px) 12rem, 10rem"
              className="object-cover"
              priority
            />
          </Link>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-p1 px-4 py-2 font-medium text-white transition hover:bg-p2"
          >
            <UploadIcon />
            <span className="hidden sm:inline">Upload Item</span>
          </button>
        </div>
      </header>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </>
  );
};

const UploadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path
      fillRule="evenodd"
      d="M11.47 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06l-3.22-3.22V16.5a.75.75 0 0 1-1.5 0V4.81L8.03 8.03a.75.75 0 0 1-1.06-1.06l4.5-4.5ZM3 15.75a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z"
      clipRule="evenodd"
    />
  </svg>
);

export default Header;
