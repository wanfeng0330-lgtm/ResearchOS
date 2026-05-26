import { useRef } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { uploadImage } from "@/utils/api";

interface ImageUploaderProps {
  placeholderId: string;
  currentImageUrl?: string;
  onUploaded: (placeholderId: string, imageUrl: string) => void;
}

export default function ImageUploader({ placeholderId, currentImageUrl, onUploaded }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadImage(file);
      onUploaded(placeholderId, result.url);
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  };

  if (currentImageUrl) {
    return (
      <div className="relative group mt-3 border border-navy-100 rounded-lg overflow-hidden">
        <img src={currentImageUrl} alt="uploaded" className="max-w-full object-contain" />
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 bg-navy-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm"
        >
          <Upload size={16} className="mr-2" />
          替换图片
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  return (
    <button
      onClick={() => inputRef.current?.click()}
      className="mt-3 w-full border-2 border-dashed border-navy-200 rounded-lg p-4 flex flex-col items-center justify-center text-navy-300 hover:border-cyan/40 hover:text-cyan transition-colors"
    >
      <ImageIcon size={24} className="mb-1" />
      <span className="text-xs">点击上传图片</span>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </button>
  );
}
