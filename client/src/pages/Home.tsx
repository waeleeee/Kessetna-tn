import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = true;
  const [formData, setFormData] = useState({
    childName: "",
    childAge: 5,
    educationalGoal: "الشجاعة والثقة بالنفس",
    problemDescription: "",
    childPhotoBase64: "",
  });

  const [showResults, setShowResults] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // tRPC
  const createStoryMutation = trpc.story.create.useMutation();
  const pollImageQuery = trpc.story.pollImage.useQuery(
    { taskId: taskId || "" },
    {
      enabled: !!taskId && showResults && !imageUrl,
      refetchInterval: (data) => (data?.status === "completed" || data?.status === "failed" ? false : 3000),
    }
  );

  useEffect(() => {
    if (pollImageQuery.data?.url) {
      setImageUrl(pollImageQuery.data.url);
    }
  }, [pollImageQuery.data]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 512;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
          else { if (h > MAX) { w *= MAX / h; h = MAX; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
          const resized = canvas.toDataURL("image/jpeg", 0.7);
          setFormData({ ...formData, childPhotoBase64: resized.split(",")[1] });
          setPhotoPreview(resized);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setImageUrl(null);
    try {
      const result = await createStoryMutation.mutateAsync(formData);
      setStoryText(result.storyText);
      setTaskId(result.taskId || null);
      setShowResults(true);
    } catch (error) {
      alert("Error creating story");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthenticated) return <div className="p-10 text-center">Please Login</div>;

  return (
    <div className="min-h-screen bg-[#fef5f0] p-4" dir="rtl">
      <div className="max-w-4xl mx-auto pt-10">
        {!showResults ? (
          <div className="card memphis-shadow bg-white p-8 rounded-xl border-4 border-[#1a1a1a]">
            <h1 className="text-4xl font-black mb-8 text-center text-[#1a1a1a]">🌟 مولد حكاياتنا</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input 
                placeholder="اسم الطفل" 
                className="w-full p-4 border-4 border-[#1a1a1a] rounded-xl text-xl"
                value={formData.childName} 
                onChange={e => setFormData({...formData, childName: e.target.value})} 
                required 
              />
              <textarea 
                placeholder="ما هو التحدي الذي يواجهه؟" 
                className="w-full p-4 border-4 border-[#1a1a1a] rounded-xl text-xl"
                rows={4}
                value={formData.problemDescription} 
                onChange={e => setFormData({...formData, problemDescription: e.target.value})} 
                required 
              />
              <div className="p-4 border-4 border-dashed border-[#1a1a1a] rounded-xl text-center">
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
                {photoPreview && <img src={photoPreview} className="mt-4 max-h-40 mx-auto rounded-lg border-2 border-[#1a1a1a]" />}
              </div>
              <button 
                type="submit" 
                disabled={isCreating}
                className="w-full bg-[#ff6b6b] text-white font-black text-2xl py-4 rounded-xl border-4 border-[#1a1a1a] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] hover:translate-y-1 hover:shadow-none transition-all"
              >
                {isCreating ? "جاري التأليف..." : "ابدأ الحكاية ✨"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-8 pb-20">
            <div className="card memphis-shadow bg-white p-10 rounded-xl border-4 border-[#1a1a1a]">
              <h2 className="text-3xl font-black mb-6">📖 القصة</h2>
              <div className="text-2xl leading-relaxed whitespace-pre-wrap">
                <Streamdown>{storyText}</Streamdown>
              </div>
            </div>

            {taskId && (
              <div className="card memphis-shadow bg-white p-10 rounded-xl border-4 border-[#1a1a1a]">
                <h2 className="text-3xl font-black mb-6">🎨 صورة الحكاية</h2>
                {!imageUrl ? (
                  <div className="text-center py-10">
                    <div className="animate-spin text-5xl mb-4">🌀</div>
                    <p className="text-xl">جاري رسم اللوحة الفنية... قد يستغرق دقيقة</p>
                  </div>
                ) : (
                  <img src={imageUrl} className="w-full rounded-xl border-4 border-[#1a1a1a]" />
                )}
              </div>
            )}
            
            <button 
              onClick={() => setShowResults(false)}
              className="w-full bg-[#4ecdc4] text-[#1a1a1a] font-black text-xl py-4 rounded-xl border-4 border-[#1a1a1a]"
            >
              🔄 قصة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
