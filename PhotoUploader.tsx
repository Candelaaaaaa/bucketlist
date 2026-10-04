// src/components/PhotoUploader.tsx
import React, { useState } from "react";
import { storage } from "../firebase";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import imageCompression from "browser-image-compression";
import { FaUpload } from "react-icons/fa";

type PhotoUploaderProps = {
  planId: string;
  onUploadComplete: (urls: string[]) => void;
};

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({ planId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // compress image (max 800px, quality 0.7)
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        initialQuality: 0.7,
      });
      const storageRef = ref(storage, `plans/${planId}/${compressed.name}`);
      const uploadTask = uploadBytesResumable(storageRef, compressed);
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setProgress(prog);
          },
          (error) => reject(error),
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            urls.push(downloadURL);
            resolve();
          }
        );
      });
    }
    setUploading(false);
    setProgress(0);
    onUploadComplete(urls);
  };

  return (
    <div className="mt-2">
      <label className="flex items-center cursor-pointer text-rose-600 hover:text-rose-800">
        <FaUpload className="mr-1" />
        <span>{uploading ? `Subiendo (${progress}%)` : "Subir fotos"}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
          disabled={uploading}
        />
      </label>
    </div>
  );
};
