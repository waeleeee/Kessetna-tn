import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { 
  Sparkles, 
  User as UserIcon, 
  Baby, 
  Target, 
  AlertCircle, 
  Camera, 
  RefreshCw,
  BookOpen,
  CheckCircle2
} from "lucide-react";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = true; // For development convenience, usually use !!user
  
  const [formData, setFormData] = useState({
    childName: "",
    childAge: 10,
    educationalGoal: "تحسين الثقة بالنفس والاندماج الاجتماعي",
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
      console.error("Error creating story:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthenticated) return <div className="p-10 text-center font-bold">يرجى تسجيل الدخول</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF5F0] to-[#FFE8D6] p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto pt-6">
        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-md rounded-3xl">
                <div className="bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] p-8 text-white text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                    className="inline-block p-4 bg-white/20 rounded-full mb-4"
                  >
                    <Sparkles className="size-12" />
                  </motion.div>
                  <h1 className="text-4xl md:text-5xl font-black mb-2 drop-shadow-sm">كتابنا السحري</h1>
                  <p className="text-white/90 text-lg md:text-xl font-medium">اصنع قصة تعليمية ملهمة لطفلك في ثوانٍ</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-10">
                  {/* Part 1: Identity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <Label className="text-xl font-bold flex items-center gap-2 text-[#1a1a1a]">
                        <UserIcon className="size-5 text-[#FF6B6B]" /> اسم البطل الصغير
                      </Label>
                      <Input 
                        placeholder="ما هو اسم طفلك؟" 
                        className="h-14 border-2 border-gray-100 focus:border-[#FF6B6B] rounded-2xl text-lg bg-gray-50/50"
                        value={formData.childName} 
                        onChange={e => setFormData({...formData, childName: e.target.value})} 
                        required 
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-xl font-bold flex items-center gap-2 text-[#1a1a1a]">
                        <Baby className="size-5 text-[#FF6B6B]" /> عمر البطل
                      </Label>
                      <Input 
                        type="number"
                        min={3}
                        max={15}
                        className="h-14 border-2 border-gray-100 focus:border-[#FF6B6B] rounded-2xl text-lg bg-gray-50/50"
                        value={formData.childAge} 
                        onChange={e => setFormData({...formData, childAge: parseInt(e.target.value)})} 
                        required 
                      />
                    </div>
                  </div>

                  {/* Part 2: Educational Goal */}
                  <div className="space-y-4">
                    <Label className="text-xl font-bold flex items-center gap-2 text-[#1a1a1a]">
                      <Target className="size-5 text-[#4ECDC4]" /> الهدف التعليمي أو التربوي
                    </Label>
                    <Input 
                      placeholder="مثال: الشجاعة، الصدق، الأكل الصحي..." 
                      className="h-14 border-2 border-gray-100 focus:border-[#4ECDC4] rounded-2xl text-lg bg-gray-50/50"
                      value={formData.educationalGoal} 
                      onChange={e => setFormData({...formData, educationalGoal: e.target.value})} 
                      required 
                    />
                  </div>

                  {/* Part 3: Challenge */}
                  <div className="space-y-4">
                    <Label className="text-xl font-bold flex items-center gap-2 text-[#1a1a1a]">
                      <AlertCircle className="size-5 text-[#FF6B6B]" /> التحدي الذي يواجهه (وصف المشكلة)
                    </Label>
                    <Textarea 
                      placeholder="أخبرنا المزيد عما يواجهه طفلك لنكتب قصة تساعده..." 
                      className="border-2 border-gray-100 focus:border-[#FF6B6B] rounded-2xl text-lg bg-gray-50/50 min-h-[120px]"
                      value={formData.problemDescription} 
                      onChange={e => setFormData({...formData, problemDescription: e.target.value})} 
                      required 
                    />
                  </div>

                  {/* Part 4: Photo Selection */}
                  <div className="space-y-4">
                    <Label className="text-xl font-bold flex items-center gap-2 text-[#1a1a1a]">
                      <Camera className="size-5 text-[#4ECDC4]" /> صورة البطل (للرسم السحري)
                    </Label>
                    <div className="relative group">
                      <div className="flex flex-col items-center justify-center border-4 border-dashed border-gray-200 group-hover:border-[#4ECDC4] rounded-3xl p-10 transition-colors bg-gray-50/30">
                        {photoPreview ? (
                          <div className="relative">
                            <img src={photoPreview} className="max-h-64 rounded-2xl shadow-lg border-4 border-white" />
                            <Button 
                              type="button"
                              onClick={() => {setPhotoPreview(""); setFormData({...formData, childPhotoBase64: ""})}}
                              className="absolute -top-3 -left-3 bg-red-500 hover:bg-red-600 rounded-full size-8 p-0"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center space-y-2">
                            <div className="inline-block p-4 bg-white rounded-full shadow-sm mb-2 text-gray-400">
                              <Camera className="size-8" />
                            </div>
                            <p className="text-gray-500 font-medium text-lg">اضغط هنا لرفع صورة طفلك</p>
                            <p className="text-gray-400 text-sm italic">سيتم تحويل ملامحه إلى شخصية في القصة!</p>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handlePhotoChange}
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                      </div>
                    </div>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      type="submit" 
                      disabled={isCreating}
                      className="w-full bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white font-black text-2xl py-8 rounded-3xl shadow-xl shadow-orange-200 hover:shadow-orange-300 transition-all border-none"
                    >
                      {isCreating ? (
                        <div className="flex items-center gap-3">
                          <RefreshCw className="animate-spin size-7" />
                          جاري تأليف الحكاية...
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <BookOpen className="size-7" />
                          ابدأ المغامرة السحرية ✨
                        </div>
                      )}
                    </Button>
                  </motion.div>
                </form>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="space-y-10 pb-20"
            >
              {/* Story Section */}
              <Card className="overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
                <div className="bg-[#4ECDC4] p-6 text-white flex justify-between items-center">
                  <h2 className="text-3xl font-black flex items-center gap-2">
                    <BookOpen className="size-8" /> حكاية {formData.childName} السحرية
                  </h2>
                  <div className="flex gap-2">
                    <div className="px-4 py-1 bg-white/20 rounded-full text-sm font-bold">
                      تم التأليف بالذكاء الاصطناعي
                    </div>
                  </div>
                </div>
                <div className="p-10">
                  <div className="prose prose-2xl max-w-none text-[#2d3436] leading-[1.8] font-medium story-content">
                    <Streamdown>{storyText}</Streamdown>
                  </div>
                </div>
              </Card>

              {/* Image Section */}
              {taskId && (
                <Card className="overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
                  <div className="bg-[#FF9F43] p-6 text-white flex justify-between items-center">
                    <h2 className="text-3xl font-black flex items-center gap-2">
                      <Sparkles className="size-8" /> لوحة الحكاية
                    </h2>
                    {imageUrl && (
                      <CheckCircle2 className="size-8 text-white/80" />
                    )}
                  </div>
                  <div className="p-8">
                    {!imageUrl ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="relative">
                          <div className="size-24 border-8 border-gray-100 border-t-[#FF9F43] rounded-full animate-spin"></div>
                          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-8 text-[#FF9F43]" />
                        </div>
                        <p className="mt-8 text-2xl font-bold text-gray-700">جاري رسم اللوحة الفنية...</p>
                        <p className="text-gray-400 mt-2">نحول ملامح {formData.childName} إلى بطل حقيقي!</p>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <img 
                          src={imageUrl} 
                          alt="Story Illustration"
                          className="w-full rounded-2xl shadow-xl border-8 border-white ring-1 ring-gray-100" 
                        />
                      </motion.div>
                    )}
                  </div>
                </Card>
              )}
              
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  onClick={() => setShowResults(false)}
                  className="w-full bg-[#1a1a1a] text-white font-black text-2xl py-8 rounded-3xl shadow-xl hover:bg-[#333] transition-all border-none"
                >
                  <RefreshCw className="size-7 ml-2" />
                  اصنع حكاية جديدة للمستقبل 🚀
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

