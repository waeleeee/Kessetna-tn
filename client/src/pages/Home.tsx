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
  CheckCircle2,
  Image as ImageIcon
} from "lucide-react";
import { StoryBook } from "@/components/StoryBook";

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
  const [scenes, setScenes] = useState<any[]>([]);
  const [characterDescription, setCharacterDescription] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([]);
  const [remainingTaskIds, setRemainingTaskIds] = useState<string[]>([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [hasFinalized, setHasFinalized] = useState(false);

  // tRPC
  const createStoryMutation = trpc.story.create.useMutation();
  const generateRemainingMutation = trpc.story.generateRemaining.useMutation();
  const finalizeStoryMutation = trpc.story.finalize.useMutation();
  const utils = trpc.useContext();
  
  // Poll for the FIRST image
  const pollFirstImage = trpc.story.pollImage.useQuery(
    { taskId: taskId || "" },
    {
      enabled: !!taskId && !imageUrls[0],
      refetchInterval: (data) => (data?.status === "completed" || data?.status === "failed" ? false : 3000),
    }
  );

  // Effect to trigger remaining images once the first one is ready
  useEffect(() => {
    const firstUrl = pollFirstImage.data?.url;
    if (firstUrl && !imageUrls[0]) {
      const newUrls = [...imageUrls];
      newUrls[0] = firstUrl;
      setImageUrls(newUrls);
      
      // Now start generating the rest using the first anime face as reference!
      generateRemainingMutation.mutateAsync({
        characterDescription,
        scenes,
        firstImageRef: firstUrl
      }).then(result => {
        setRemainingTaskIds(result.taskIds);
      });
    }
  }, [pollFirstImage.data]);

  // Poll for the remaining images
  useEffect(() => {
    if (remainingTaskIds.length === 0) return;

    const interval = setInterval(async () => {
      let allDone = true;
      const newUrls = [...imageUrls];

      for (let i = 0; i < remainingTaskIds.length; i++) {
        const id = remainingTaskIds[i];
        if (!id) continue;
        
        const imageIndex = i + 1; // 0 is the first image
        if (!newUrls[imageIndex]) {
          allDone = false;
          try {
            const data = await utils.story.pollImage.fetch({ taskId: id });
            if (data.status === "completed" && data.url) {
              newUrls[imageIndex] = data.url;
              setImageUrls([...newUrls]);
            } else if (data.status === "failed") {
              newUrls[imageIndex] = "https://placehold.co/600x400/f7f1e3/8b4513?text=فشل+توليد+الصورة";
              setImageUrls([...newUrls]);
            }
          } catch (e) {
            console.error("Polling error for", id, e);
          }
        }
      }

      if (allDone) clearInterval(interval);
    }, 4000);

    return () => clearInterval(interval);
  }, [remainingTaskIds, imageUrls, utils]);

  // Automatically finalize the story once ALL images are loaded
  useEffect(() => {
    if (showResults && !hasFinalized && scenes.length > 0 && imageUrls.length === scenes.length && imageUrls.every(url => !!url)) {
      setHasFinalized(true);
      finalizeStoryMutation.mutate({
        title: formData.childName,
        scenes: scenes,
        imageUrls: imageUrls as string[]
      });
      console.log("[Story] All images ready. Finalizing automatically...");
    }
  }, [imageUrls, scenes, showResults, hasFinalized]);

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
    setImageUrls([]);
    setRemainingTaskIds([]);
    setHasFinalized(false);
    try {
      const result = await createStoryMutation.mutateAsync(formData);
      setScenes(result.scenes || []);
      setCharacterDescription(result.characterDescription || "");
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
    <div className="min-h-screen bg-[#FDFBF7] p-4 md:p-8 font-['Fredoka']" dir="rtl">
      <div className="max-w-7xl mx-auto pt-6">
        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="overflow-hidden border-none shadow-2xl bg-[#FFF9F2]/80 backdrop-blur-md rounded-[3rem]">
                <div className="bg-gradient-to-r from-[#8B4513] to-[#A0522D] p-10 text-white text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/old-mathematics.png')]"></div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                    className="inline-block p-4 bg-white/20 rounded-full mb-4"
                  >
                    <Sparkles className="size-12" />
                  </motion.div>
                  <h1 className="text-5xl md:text-6xl font-black mb-4 drop-shadow-lg font-['Playfair_Display']">حكاياتنا التونسية القديمة</h1>
                  <p className="text-white/90 text-xl md:text-2xl font-medium">حول ملامح طفلك إلى بطل في قصة فنية كلاسيكية</p>
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
                    <div className="flex flex-col md:flex-row gap-4">
                      <Button 
                        type="submit" 
                        disabled={isCreating}
                        className="flex-1 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white font-black text-2xl py-8 rounded-3xl shadow-xl shadow-orange-200 hover:shadow-orange-300 transition-all border-none"
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
                      
                      <Button 
                        type="button"
                        onClick={() => {
                          setScenes([
                            {
                              text: "فِي قَديمِ الزَّمانِ، كانَ هُناكَ طِفلٌ صَغيرٌ يَدعَى آدَم، يَعِيشُ فِي مَدينَةِ سِيدي بوسَعيد الجَميلَة.",
                              imagePrompt: "Watercolor illustration of a child in Sidi Bou Said"
                            },
                            {
                              text: "كانَ آدَم يُحِبُّ التَّجَوُّلَ فِي الأَزِقَّةِ الزَّرقاءِ وَالبَيضاءِ، وَيَحْلُمُ بِأَن يَكونَ رَسَّاماً مَشْهوراً.",
                              imagePrompt: "Watercolor illustration of blue and white streets"
                            },
                            {
                              text: "وَفِي يَومٍ مِنَ الأَيَّامِ، وَجَدَ ريشَةً سِحْريَّةً بَيْنَ الصُّخورِ البَحريَّةِ.",
                              imagePrompt: "Watercolor illustration of a magic brush near the sea"
                            }
                          ]);
                          setImageUrls([
                            "https://placehold.co/600x400/f7f1e3/8b4513?text=مشهد+توضيحي+1",
                            "https://placehold.co/600x400/f7f1e3/8b4513?text=مشهد+توضيحي+2",
                            "https://placehold.co/600x400/f7f1e3/8b4513?text=مشهد+توضيحي+3"
                          ]);
                          setShowResults(true);
                        }}
                        className="bg-[#4ECDC4] text-white font-black text-xl py-8 px-10 rounded-3xl shadow-xl shadow-teal-100 hover:shadow-teal-200 transition-all border-none"
                      >
                        <ImageIcon className="size-7 ml-2" />
                        تجربة الكتاب 📖
                      </Button>
                    </div>
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
              <Card className="overflow-hidden border-none shadow-2xl bg-[#fefefe] rounded-[3rem]">
                <div className="bg-[#8B4513] p-8 text-white flex justify-between items-center relative overflow-hidden">
                   <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/old-mathematics.png')]"></div>
                  <h2 className="text-4xl font-black flex items-center gap-3 font-['Playfair_Display'] relative z-10">
                    <BookOpen className="size-10" /> حكاية {formData.childName}
                  </h2>
                  <div className="flex gap-4 relative z-10">
                    <Button 
                      variant="outline" 
                      className="bg-white/20 border-white/40 text-white hover:bg-white/30 font-bold rounded-2xl py-6 px-8 text-lg"
                      onClick={() => setShowPdfPreview(!showPdfPreview)}
                    >
                      {showPdfPreview ? "الرجوع للكتاب التفاعلي 📖" : "معاينة نسخة الطباعة PDF 📄"}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="bg-white/20 border-white/40 text-white hover:bg-white/30 font-bold rounded-2xl py-6 px-8 text-lg"
                      onClick={() => window.print()}
                    >
                      تحميل النسخة الفنية PDF 📄
                    </Button>
                  </div>
                </div>
                <div className="p-0 bg-[#f7f1e3] overflow-hidden interactive-book-only relative">
                  {!showPdfPreview ? (
                    <StoryBook 
                      pages={scenes.map((scene, i) => ({
                        image: imageUrls[i] || "https://placehold.co/600x400/f7f1e3/8b4513?text=جاري+تحضير+اللوحة+الفنية...",
                        text: scene.text
                      }))}
                    />
                  ) : (
                    <div className="max-h-[800px] overflow-y-auto p-10 space-y-10 bg-[#e5e5e5]">
                      {scenes.map((scene, i) => (
                        <div key={i} className="flex flex-col md:flex-row bg-[#f7f1e3] shadow-2xl rounded-xl overflow-hidden min-h-[500px]">
                          <div className="w-full md:w-1/2 aspect-square md:aspect-auto">
                            <img 
                              src={imageUrls[i] || "https://placehold.co/600x400/f7f1e3/8b4513?text=جاري+تحضير..."} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="w-full md:w-1/2 p-12 flex flex-col justify-center items-end bg-[#f7f1e3] relative">
                            <div className="absolute top-4 left-4 text-4xl font-black text-black/5 select-none">
                              {i * 2 + 2}
                            </div>
                            <p className="text-3xl font-bold text-right leading-relaxed text-[#4b4b4b]">
                              {scene.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!imageUrls[0] && (
                    <div className="absolute inset-0 bg-black/5 backdrop-blur-[2px] flex items-center justify-center z-50 pointer-events-none">
                      <div className="bg-white/90 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border-2 border-[#8B4513]/20">
                        <RefreshCw className="size-12 text-[#8B4513] animate-spin" />
                        <p className="text-2xl font-black text-[#8B4513]">الرسام السحري يجهز لوحاتك...</p>
                        <p className="text-sm font-medium text-[#8B4513]/60 italic">قد يستغرق ذلك دقيقة لضمان دقة الملامح</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Full Story Print Layout (Hidden on Screen, Visible on PDF) */}
                <div className="hidden print-only-layout">
                  {scenes.map((scene, i) => (
                    <div key={i} className="print-spread">
                      <div className="print-page">
                        <img 
                          src={imageUrls[i] || "https://placehold.co/600x400/f7f1e3/8b4513?text=جاري+تحضير+اللوحة+الفنية..."} 
                          className="bg-[#f7f1e3]"
                        />
                        <div className="page-number-indicator">
                          {i * 2 + 1}
                        </div>
                      </div>
                      <div className="print-page">
                        <div className="print-text-container">
                          <p>{scene.text}</p>
                          <div className="page-number-indicator">
                            {i * 2 + 2}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Reset Button */}
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

