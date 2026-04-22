import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

interface StoryData {
  storyId: number;
  storyText: string;
  hasImages: boolean;
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    childName: "",
    childAge: 5,
    educationalGoal: "الشجاعة والثقة بالنفس",
    problemDescription: "",
    childPhotoBase64: "",
  });

  const [storyId, setStoryId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  
  // Login success detector for Vercel
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("login_success") === "true") {
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.reload();
    }
  }, []);

  // tRPC mutations and queries
  const createStoryMutation = trpc.story.create.useMutation();
  const getStatusQuery = trpc.story.getStatus.useQuery(
    { storyId: storyId || 0 },
    {
      enabled: !!storyId && showResults,
      refetchInterval: storyId && showResults && storyData?.hasImages ? 3000 : false,
    }
  );

  // Sync query data to local state using useEffect
  useEffect(() => {
    if (getStatusQuery.data) {
      const { story, images } = getStatusQuery.data;
      setStoryData({
        storyId: story.id,
        storyText: story.storyText || "",
        hasImages: images.length > 0,
      });
    }
  }, [getStatusQuery.data]);

  // Handle photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data:image/jpeg;base64, prefix
        const base64Data = base64String.split(",")[1] || base64String;
        setFormData({ ...formData, childPhotoBase64: base64Data });
        setPhotoPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const result = await createStoryMutation.mutateAsync({
        childName: formData.childName,
        childAge: formData.childAge,
        educationalGoal: formData.educationalGoal,
        problemDescription: formData.problemDescription,
        childPhotoBase64: formData.childPhotoBase64 || undefined,
      });

      setStoryId(result.storyId);
      setStoryData({
        storyId: result.storyId,
        storyText: result.storyText,
        hasImages: result.hasImages,
      });
      setShowResults(true);
    } catch (error) {
      console.error("Error creating story:", error);
      alert("حدث خطأ أثناء إنشاء القصة. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    setFormData({
      childName: "",
      childAge: 5,
      educationalGoal: "الشجاعة والثقة بالنفس",
      problemDescription: "",
      childPhotoBase64: "",
    });
    setPhotoPreview("");
    setStoryId(null);
    setShowResults(false);
    setStoryData(null);
  };

  // If not authenticated, show login prompt
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fef5f0]">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fef5f0] p-4" dir="rtl">
        <div className="card memphis-shadow max-w-md text-center">
          <h1 className="heading-memphis mb-4">🌟 مولد قصص الأطفال</h1>
          <p className="text-lg mb-6 text-[#1a1a1a]">
            يرجى تسجيل الدخول لإنشاء قصص جميلة لطفلك
          </p>
          <button
            onClick={() => (window.location.href = getLoginUrl())}
            className="w-full border-2 border-[#1a1a1a] rounded px-6 py-3 bg-[#ff6b6b] text-white font-bold hover:bg-[#ff5252] transition-all"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fef5f0] relative overflow-hidden" dir="rtl">
      {/* Memphis Background Shapes */}
      <div className="absolute top-10 left-10 w-24 h-24 bg-[#ffd93d] rounded-full opacity-40"></div>
      <div className="absolute top-32 right-20 w-32 h-32 bg-[#4ecdc4] opacity-30" style={{ clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)" }}></div>
      <div className="absolute bottom-20 left-1/4 w-20 h-20 bg-[#dda0dd] opacity-40"></div>
      <div className="absolute bottom-40 right-1/3 w-28 h-28 bg-[#a8e6cf] rounded-full opacity-30"></div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header Section */}
        {!showResults && (
          <>
            <div className="text-center mb-12">
              <h1 className="heading-memphis mb-2">🌟 مولد قصص الأطفال</h1>
              <p className="subheading-memphis">إنشاء قصص تربوية مخصصة لطفلك</p>
            </div>

            {/* Form Section */}
            <div className="max-w-2xl mx-auto mb-12">
              <form onSubmit={handleSubmit} className="card memphis-shadow">
                {/* Child Name */}
                <div className="form-group">
                  <label className="form-label">اسم الطفل</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="أدخل اسم الطفل"
                    value={formData.childName}
                    onChange={(e) =>
                      setFormData({ ...formData, childName: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Age */}
                <div className="form-group">
                  <label className="form-label">العمر</label>
                  <input
                    type="number"
                    className="form-input"
                    min="3"
                    max="12"
                    value={formData.childAge}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        childAge: parseInt(e.target.value),
                      })
                    }
                    required
                  />
                </div>

                {/* Educational Goal */}
                <div className="form-group">
                  <label className="form-label">الهدف التربوي</label>
                  <select
                    className="form-input"
                    value={formData.educationalGoal}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        educationalGoal: e.target.value,
                      })
                    }
                  >
                    <option>الشجاعة والثقة بالنفس</option>
                    <option>الصداقة والتعاون</option>
                    <option>الصدق والأمانة</option>
                    <option>احترام الآخرين</option>
                    <option>التعلم والفضول</option>
                    <option>التعامل مع الخوف</option>
                  </select>
                </div>

                {/* Problem Description */}
                <div className="form-group">
                  <label className="form-label">المشكلة التي يواجهها الطفل</label>
                  <textarea
                    className="form-input"
                    placeholder="صف المشكلة أو التحدي الذي يواجهه الطفل"
                    rows={4}
                    value={formData.problemDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        problemDescription: e.target.value,
                      })
                    }
                    required
                  ></textarea>
                </div>

                {/* Photo Upload */}
                <div className="form-group">
                  <label className="form-label">صورة الطفل (اختياري)</label>
                  <div className="border-2 border-dashed border-[#1a1a1a] rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                      id="photo-input"
                    />
                    <label htmlFor="photo-input" className="cursor-pointer block">
                      {photoPreview ? (
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="w-24 h-24 object-cover rounded"
                          />
                          <p className="text-sm text-[#4ecdc4]">انقر لتغيير الصورة</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-lg mb-2">📸</p>
                          <p className="text-[#1a1a1a]">انقر لاختيار صورة الطفل</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={
                    isCreating ||
                    !formData.childName ||
                    !formData.problemDescription
                  }
                  className="w-full border-2 border-[#1a1a1a] rounded px-6 py-3 bg-[#ff6b6b] text-white font-bold hover:bg-[#ff5252] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating
                    ? "جاري الإنشاء..."
                    : "إنشاء القصة والصور"}
                </button>

                {createStoryMutation.error && (
                  <div className="mt-4 p-3 bg-red-100 text-red-700 rounded border border-red-300">
                    {createStoryMutation.error.message}
                  </div>
                )}
              </form>
            </div>
          </>
        )}

        {/* Loading State */}
        {showResults && isCreating && (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="spinner mb-4"></div>
            <p className="text-xl text-[#1a1a1a] font-semibold">
              جاري إنشاء قصتك الرائعة...
            </p>
          </div>
        )}

        {/* Results Section */}
        {showResults && !isCreating && storyData && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h2 className="heading-memphis mb-4 text-center">
                قصة {storyData.storyId > 0 ? "الطفل" : ""}
              </h2>

              {/* Story with Images */}
              {storyData.storyText && getStatusQuery.data && (
                <div className="space-y-8">
                  {getStatusQuery.data.images.length > 0 ? (
                    // Render paragraphs paired with images
                    getStatusQuery.data.images.map((image, idx) => (
                      <div key={image.id} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Paragraph */}
                        <div className="card memphis-shadow order-2 md:order-1">
                          <div className="story-paragraph">
                            {storyData.storyText.split("\n").filter(p => p.trim())[idx] || ""}
                          </div>
                        </div>

                        {/* Image */}
                        <div className="image-container memphis-shadow order-1 md:order-2">
                          {image.imageUrl ? (
                            <img src={image.imageUrl} alt={`صورة ${idx}`} />
                          ) : image.status === "processing" ? (
                            <div className="flex items-center justify-center h-64 bg-gray-100">
                              <div className="spinner"></div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-64 bg-gray-100">
                              <p className="text-gray-500">فشل تحميل الصورة</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    // Show story text without images
                    <div className="card memphis-shadow">
                      <div className="story-paragraph">
                        <Streamdown>{storyData.storyText}</Streamdown>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reset Button */}
              <div className="text-center mt-8">
                <button
                  onClick={handleReset}
                  className="border-2 border-[#1a1a1a] rounded px-6 py-3 bg-[#4ecdc4] text-white font-bold hover:bg-[#45b8b8] transition-all"
                >
                  إنشاء قصة جديدة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
