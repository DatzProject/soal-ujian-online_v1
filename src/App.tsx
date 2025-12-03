import React, { useState, useEffect } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";

// Replace with your deployed Google Apps Script Web App URL
const scriptURL =
  "https://script.google.com/macros/s/AKfycby9mAD7563SoyieCfQ0GqJqQJnqJhjZyg55zDnpur5C9HjPcy1lvMUt6zRu9Squ9IMyUA/exec";

interface QuizQuestion {
  id: string;
  soal: string;
  gambar: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  jawaban: string;
}

interface SubjectData {
  mapel: string;
  materi: string;
  sheetName: string;
  status: string;
}

interface StudentData {
  nisn: string;
  nama_siswa: string;
}

interface QuestionData {
  questionNumber: number;
  questionText: string;
  imageUrl: string;
  selectedAnswerText: string;
  isCorrect: boolean;
  correctOption: string; // Tambah ini untuk opsi benar (misal "A")
  correctText: string; // Tambah ini untuk teks opsi benar lengkap
}

const OnlineExam: React.FC = () => {
  const [nisn, setNisn] = useState<string>("");
  const [namaSiswa, setNamaSiswa] = useState<string>("");
  const [selectedMapel, setSelectedMapel] = useState<string>("");
  const [selectedMateri, setSelectedMateri] = useState<string>("");
  const [selectedJenisUjian, setSelectedJenisUjian] = useState<string>("");
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false); // New state for verification loading
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [examStarted, setExamStarted] = useState<boolean>(false);
  const [subjectsData, setSubjectsData] = useState<SubjectData[]>([]);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(3600); // 30 minutes in seconds
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5); // 5-second countdown
  const [kkm, setKkm] = useState<number>(30); // Default KKM value
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false); // Confirmation dialog state
  const examDuration = 1800; // Configurable exam duration in seconds

  // Timer effect for exam
  useEffect(() => {
    if (examStarted && timeLeft > 0 && !isSubmitting && score === null) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            submitExam(true); // Auto-submit when time runs out
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [examStarted, timeLeft, isSubmitting, score]);

  // Countdown effect after verification
  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      const countdownTimer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimer);
            setIsCountingDown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(countdownTimer);
    }
  }, [isCountingDown, countdown]);

  // Fetch DataMapel, DataSiswa, and KKM
  useEffect(() => {
    // Fetch DataMapel
    fetch(`${scriptURL}?action=getDataMapel`, {
      method: "GET",
      mode: "cors",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const filteredData = data.data.filter(
            (item: SubjectData) => item.status === "Izinkan"
          );
          setSubjectsData(filteredData);
        } else {
          setSubmitStatus(
            `❌ Gagal mengambil data mapel: ${
              data.message || "Kesalahan server."
            }`
          );
        }
      })
      .catch((error) => {
        console.error("Error fetching DataMapel:", error);
        setSubmitStatus("❌ Gagal mengambil data mapel: Kesalahan jaringan.");
      });

    // Fetch DataSiswa
    fetch(`${scriptURL}?action=getDataSiswa`, {
      method: "GET",
      mode: "cors",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setStudentsData(data.data);
        } else {
          setSubmitStatus(
            `❌ Gagal mengambil data siswa: ${
              data.message || "Kesalahan server."
            }`
          );
        }
      })
      .catch((error) => {
        console.error("Error fetching DataSiswa:", error);
        setSubmitStatus("❌ Gagal mengambil data siswa: Kesalahan jaringan.");
      });

    // Fetch KKM
    fetch(`${scriptURL}?action=getKKM`, {
      method: "GET",
      mode: "cors",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && typeof data.kkm === "number") {
          setKkm(data.kkm);
        } else {
          setSubmitStatus(
            `❌ Gagal mengambil nilai KKM: ${
              data.message || "Kesalahan server."
            }`
          );
        }
      })
      .catch((error) => {
        console.error("Error fetching KKM:", error);
        setSubmitStatus("❌ Gagal mengambil nilai KKM: Kesalahan jaringan.");
      });
  }, []);

  const verifyStudent = () => {
    const trimmedNisn = nisn.trim();
    const trimmedNamaSiswa = namaSiswa.trim();
    if (
      !selectedMapel ||
      !selectedMateri ||
      !selectedJenisUjian ||
      !trimmedNisn ||
      !trimmedNamaSiswa
    ) {
      setSubmitStatus("⚠️ Semua field wajib diisi!");
      return;
    }

    const selectedSubject = subjectsData.find(
      (s) => s.mapel === selectedMapel && s.materi === selectedMateri
    );
    if (!selectedSubject || selectedSubject.status !== "Izinkan") {
      setSubmitStatus("❌ Mapel dan materi tidak diizinkan untuk ujian.");
      return;
    }

    // Set loading state
    setIsVerifying(true);
    setSubmitStatus("⏳ Memproses verifikasi...");

    fetch(
      `${scriptURL}?action=verifyStudent&nisn=${encodeURIComponent(
        trimmedNisn
      )}&nama_siswa=${encodeURIComponent(trimmedNamaSiswa)}`,
      {
        method: "GET",
        mode: "cors",
      }
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setIsVerified(true);
          setIsCountingDown(true); // Start countdown
          setCountdown(5); // Reset countdown to 5 seconds
          setSubmitStatus("✅ Verifikasi berhasil! Memuat soal...");
          setSelectedSheet(selectedSubject.sheetName);
          fetch(
            `${scriptURL}?action=getQuestions&sheet=${encodeURIComponent(
              selectedSubject.sheetName
            )}`,
            {
              method: "GET",
              mode: "cors",
            }
          )
            .then((response) => response.json())
            .then((data) => {
              if (data.success && Array.isArray(data.data)) {
                const formattedQuestions = data.data.map(
                  (q: any, index: number) => ({
                    id: index.toString(),
                    soal: q.question || "",
                    gambar: q.imageUrl || "",
                    opsiA: q.optionA || "",
                    opsiB: q.optionB || "",
                    opsiC: q.optionC || "",
                    opsiD: q.optionD || "",
                    jawaban: q.answer || "A",
                  })
                );
                setQuestions(formattedQuestions);
                if (formattedQuestions.length === 0) {
                  setSubmitStatus(
                    `❌ Tidak ada soal valid di sheet ${selectedSubject.sheetName}.`
                  );
                  setIsCountingDown(false); // Stop countdown if no questions
                } else {
                  setSubmitStatus(
                    "✅ Soal berhasil dimuat! Siap memulai ujian."
                  );
                }
              } else {
                setSubmitStatus(
                  `❌ Gagal mengambil soal dari sheet ${
                    selectedSubject.sheetName
                  }: ${
                    data.message || "Data soal tidak valid atau sheet kosong."
                  }`
                );
                setIsCountingDown(false); // Stop countdown on error
              }
              setIsVerifying(false); // Stop loading state
            })
            .catch((error) => {
              console.error("Error fetching questions:", error);
              setSubmitStatus(
                `❌ Gagal mengambil soal dari sheet ${selectedSubject.sheetName}: Kesalahan jaringan - ${error.message}`
              );
              setIsCountingDown(false); // Stop countdown on error
              setIsVerifying(false); // Stop loading state
            });
        } else {
          setSubmitStatus(
            `❌ ${data.message || "NISN atau Nama Siswa tidak valid."}`
          );
          setIsVerifying(false); // Stop loading state
        }
      })
      .catch((error) => {
        console.error("Error verifying student:", error);
        setSubmitStatus(
          `❌ Gagal memverifikasi data siswa: Kesalahan jaringan - ${error.message}`
        );
        setIsVerifying(false); // Stop loading state
      });
  };

  const startExam = () => {
    if (isVerified && questions.length > 0) {
      setExamStarted(true);
      setTimeLeft(examDuration); // Reset timer to exam duration
      setSubmitStatus("");
    } else {
      setSubmitStatus("⚠️ Verifikasi gagal atau tidak ada soal tersedia!");
    }
  };

  const handleAnswerChange = (index: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [index]: answer }));
    setAnsweredQuestions((prev) => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const handleFinishExam = () => {
    if (Object.keys(answers).length < questions.length) {
      setSubmitStatus("⚠️ Silakan jawab semua soal!");
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmSubmitExam = () => {
    setShowConfirmDialog(false);
    submitExam(false);
  };

  const cancelSubmitExam = () => {
    setShowConfirmDialog(false);
  };

  const submitExam = (isAutoSubmit: boolean = false) => {
    setIsSubmitting(true);
    setSubmitStatus(
      isAutoSubmit
        ? "⏰ Waktu habis! Mengirim jawaban..."
        : "Mengirim jawaban..."
    );

    let correctAnswers = 0;
    const totalQuestions = questions.length;
    const answerArray = Array(20).fill("");
    const questionsData: QuestionData[] = []; // Update ini: Gunakan tipe array dari interface

    questions.forEach((question, index) => {
      const selectedOption = answers[index];
      let answerText = "";
      let isCorrect = false;

      if (selectedOption) {
        switch (selectedOption) {
          case "A":
            answerText = question.opsiA ? `A. ${question.opsiA}` : "";
            break;
          case "B":
            answerText = question.opsiB ? `B. ${question.opsiB}` : "";
            break;
          case "C":
            answerText = question.opsiC ? `C. ${question.opsiC}` : "";
            break;
          case "D":
            answerText = question.opsiD ? `D. ${question.opsiD}` : "";
            break;
        }

        if (selectedOption === question.jawaban) {
          correctAnswers++;
          isCorrect = true;
        }

        // TAMBAHKAN KETERANGAN (Benar) atau (Salah)
        answerText += isCorrect ? " (Benar)" : " (Salah)";
      } else {
        answerText = isAutoSubmit
          ? "Tidak dijawab (Salah)"
          : "Tidak dijawab (Salah)";
      }

      if (index < 20) {
        answerArray[index] = answerText;
      }

      let correctText = "";
      switch (question.jawaban) {
        case "A":
          correctText = question.opsiA ? `A. ${question.opsiA}` : "";
          break;
        case "B":
          correctText = question.opsiB ? `B. ${question.opsiB}` : "";
          break;
        case "C":
          correctText = question.opsiC ? `C. ${question.opsiC}` : "";
          break;
        case "D":
          correctText = question.opsiD ? `D. ${question.opsiD}` : "";
          break;
      }

      questionsData.push({
        questionNumber: index + 1,
        questionText: question.soal,
        imageUrl: question.gambar,
        selectedAnswerText: answerText,
        isCorrect: isCorrect,
        correctOption: question.jawaban,
        correctText: correctText,
      });
    });

    // Calculate final score as percentage
    const calculatedScore = Math.round((correctAnswers / totalQuestions) * 100);

    // Determine status based on KKM
    const status = calculatedScore >= kkm ? "Lulus" : "Tidak Lulus";

    // Prepare data for submission (TAMBAH questionsData di sini)
    const submissionData = {
      action: "submitExamResults",
      nisn: nisn,
      nama: namaSiswa,
      mata_pelajaran: selectedMapel,
      bab_nama: selectedMateri,
      jumlah_benar: correctAnswers,
      total_soal: totalQuestions,
      nilai: calculatedScore,
      status: status,
      persentase: calculatedScore,
      jenis_ujian: selectedJenisUjian,
      answers: answerArray,
      questionsData: questionsData, // Tambah ini: array detail soal + koreksi
      folderId: "1ygdxdgZM7cWrdWgEJnq37T-aDFimnA6J", // ID folder Drive
    };

    console.log("Data yang dikirim:", submissionData);

    // Create form data for better compatibility (HAPUS pdfFile karena backend buat sendiri)
    const formData = new FormData();
    formData.append("action", "submitExamResults");
    formData.append("data", JSON.stringify(submissionData)); // Kirim semua data sebagai JSON

    fetch(scriptURL, {
      method: "POST",
      mode: "cors",
      body: formData,
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          console.log("Upload dan pengiriman sukses:", data);
          setScore(calculatedScore);
          setSubmitStatus(
            isAutoSubmit
              ? `⏰ Waktu habis! Ujian selesai. Skor Anda: ${calculatedScore}/100 (${correctAnswers}/${totalQuestions} benar) - Status: ${status}`
              : `✅ Ujian selesai! Skor Anda: ${calculatedScore}/100 (${correctAnswers}/${totalQuestions} benar) - Status: ${status}`
          );
          setIsSubmitting(false);
        } else {
          throw new Error(
            data.message || "Gagal mengupload PDF atau menyimpan data."
          );
        }
      })
      .catch((error) => {
        console.error("Error submitting exam:", error);
        setSubmitStatus(`❌ Gagal mengirim hasil ujian: ${error.message}`);
        setIsSubmitting(false);
      });
  };

  // Format timeLeft as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = (num: number) => (num < 10 ? `0${num}` : `${num}`);
    return `${pad(minutes)}:${pad(secs)}`;
  };

  // Function to sanitize text
  const sanitizeText = (text: string): string => {
    return text
      .replace(/\.pdf$/i, "") // Remove .pdf extension
      .replace(/['"]/g, "") // Remove stray quotes
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  };

  // Function to get formatted answer and correctness for review
  const getFormattedAnswer = (
    question: QuizQuestion,
    index: number
  ): { text: string; isCorrect: boolean } => {
    const selectedOption = answers[index];
    const isCorrect = !!selectedOption && selectedOption === question.jawaban;
    if (!selectedOption) {
      return { text: "Tidak dijawab", isCorrect: false };
    }
    switch (selectedOption) {
      case "A":
        return {
          text: question.opsiA
            ? `A. ${sanitizeText(question.opsiA)}`
            : "Tidak dijawab",
          isCorrect,
        };
      case "B":
        return {
          text: question.opsiB
            ? `B. ${sanitizeText(question.opsiB)}`
            : "Tidak dijawab",
          isCorrect,
        };
      case "C":
        return {
          text: question.opsiC
            ? `C. ${sanitizeText(question.opsiC)}`
            : "Tidak dijawab",
          isCorrect,
        };
      case "D":
        return {
          text: question.opsiD
            ? `D. ${sanitizeText(question.opsiD)}`
            : "Tidak dijawab",
          isCorrect,
        };
      default:
        return { text: "Tidak dijawab", isCorrect: false };
    }
  };

  // Function to generate and download PDF using jsPDF
  const generatePDF = (
    forDownload: boolean = false
  ): { pdfBlob?: Blob; filename: string } => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Set font and size
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);

    // Add Hasil Ujian section
    doc.text("Hasil Ujian", 10, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`NISN: ${sanitizeText(nisn)}`, 10, 20);
    doc.text(`Nama: ${sanitizeText(namaSiswa)}`, 10, 30);
    doc.text(`Mapel: ${sanitizeText(selectedMapel)}`, 10, 40);
    doc.text(`Materi: ${sanitizeText(selectedMateri)}`, 10, 50);
    doc.text(`Jenis Ujian: ${sanitizeText(selectedJenisUjian)}`, 10, 60);
    doc.text(`Skor: ${score !== null ? score : 0}/100`, 10, 70);
    doc.text(
      `Status: ${score !== null && score >= kkm ? "Lulus" : "Tidak Lulus"}`,
      10,
      80
    );

    // Add Review Jawaban Anda section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Review Jawaban Anda", 10, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    let yPosition = 110;
    const pageHeight = doc.internal.pageSize.height;
    const marginBottom = 20;

    questions.forEach((question, index) => {
      const { text, isCorrect } = getFormattedAnswer(question, index);
      const questionText = `Soal ${index + 1}: ${sanitizeText(question.soal)}`;
      const answerText = `Jawaban Anda: ${text} [${
        isCorrect ? "Benar" : "Salah"
      }]`;
      const imagePlaceholder = question.gambar
        ? `[Gambar: ${sanitizeText(question.gambar)}]`
        : "";

      // Check if adding content will exceed page height
      if (yPosition + 30 > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = 10;
      }

      // Split long text to avoid overflow
      const questionLines = doc.splitTextToSize(questionText, 180);
      doc.setFont("helvetica", "bold");
      doc.text(questionLines, 10, yPosition);
      yPosition += questionLines.length * 6;

      if (imagePlaceholder) {
        if (yPosition + 10 > pageHeight - marginBottom) {
          doc.addPage();
          yPosition = 10;
        }
        doc.setFont("helvetica", "normal");
        doc.text(imagePlaceholder, 10, yPosition);
        yPosition += 6;
      }

      if (yPosition + 10 > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = 10;
      }
      doc.setFont("helvetica", "normal");
      doc.text(answerText, 10, yPosition);
      yPosition += 10;
    });

    const filename = `Hasil_Ujian_${sanitizeText(namaSiswa).replace(
      /\s+/g,
      "_"
    )}_${Date.now()}.pdf`; // Tambah timestamp untuk nama file unik

    if (forDownload) {
      doc.save(filename); // Simpan PDF secara lokal hanya jika untuk download (tapi tombol download sudah dihilangkan)
      return { filename };
    } else {
      const pdfBlob = doc.output("blob"); // Buat sebagai Blob untuk diupload
      return { pdfBlob, filename };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-800">Ujian Online</h1>
          </div>

          <p className="text-gray-600 mb-6">
            Pilih mapel, materi, jenis ujian, nama siswa, dan masukkan NISN
            untuk memulai ujian.
          </p>

          {submitStatus && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                submitStatus.includes("berhasil") ||
                submitStatus.includes("Ujian selesai")
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : submitStatus.includes("Mengirim") ||
                    submitStatus.includes("Waktu habis") ||
                    submitStatus.includes("Memproses") ||
                    submitStatus.includes("Memuat")
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-red-100 text-red-700 border border-red-200"
              }`}
            >
              {submitStatus}
            </div>
          )}

          {!examStarted && score === null ? (
            <div className="grid gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mapel
                </label>
                <select
                  value={selectedMapel}
                  onChange={(e) => setSelectedMapel(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isVerifying}
                >
                  <option value="">Pilih Mapel</option>
                  {Array.from(new Set(subjectsData.map((s) => s.mapel))).map(
                    (mapel) => (
                      <option key={mapel} value={mapel}>
                        {mapel}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materi
                </label>
                <select
                  value={selectedMateri}
                  onChange={(e) => setSelectedMateri(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!selectedMapel || isVerifying}
                >
                  <option value="">Pilih Materi</option>
                  {subjectsData
                    .filter((s) => s.mapel === selectedMapel)
                    .map((s) => (
                      <option key={`${s.mapel}-${s.materi}`} value={s.materi}>
                        {s.materi}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jenis Ujian
                </label>
                <select
                  value={selectedJenisUjian}
                  onChange={(e) => setSelectedJenisUjian(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isVerifying}
                >
                  <option value="">Pilih Jenis Ujian</option>
                  <option value="UTAMA">UTAMA</option>
                  <option value="REMEDIAL">REMEDIAL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Siswa
                </label>
                <select
                  value={namaSiswa}
                  onChange={(e) => setNamaSiswa(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isVerifying}
                >
                  <option value="">Pilih Nama Siswa</option>
                  {studentsData.map((student) => (
                    <option key={student.nisn} value={student.nama_siswa}>
                      {student.nama_siswa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NISN
                </label>
                <input
                  type="password"
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Masukkan NISN"
                  disabled={isVerifying}
                />
              </div>
              {!isVerified && (
                <button
                  onClick={verifyStudent}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                    isVerifying
                      ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  disabled={isCountingDown || isVerifying}
                >
                  {isVerifying ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <BookOpen size={20} />
                  )}
                  {isVerifying ? "Memproses..." : "Verifikasi dan Muat Soal"}
                </button>
              )}
              {isCountingDown && (
                <div className="text-center text-lg font-semibold text-blue-700 mt-4">
                  Tunggu memuat soal dalam hitungan {countdown}
                </div>
              )}
              {isVerified && !isCountingDown && !isVerifying && (
                <button
                  onClick={startExam}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <BookOpen size={20} />
                  Mulai Ujian
                </button>
              )}
            </div>
          ) : score !== null ? (
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Hasil Ujian
              </h2>
              <p className="text-lg text-gray-600 mb-4">
                NISN: {nisn}
                <br />
                Nama: {namaSiswa}
                <br />
                Mapel: {selectedMapel}
                <br />
                Materi: {selectedMateri}
                <br />
                Jenis Ujian: {selectedJenisUjian}
                <br />
                Skor: {score}/100
                <br />
                Status: {score >= kkm ? "Lulus" : "Tidak Lulus"}
              </p>
              <div className="mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Review Jawaban Anda
                </h3>
                <div className="space-y-6">
                  {questions.map((question, index) => {
                    const { text, isCorrect } = getFormattedAnswer(
                      question,
                      index
                    );
                    return (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                      >
                        <h4 className="text-md font-semibold text-gray-800 mb-2">
                          Soal {index + 1}
                        </h4>
                        <p className="text-gray-700 mb-2">{question.soal}</p>
                        {question.gambar && (
                          <img
                            src={question.gambar}
                            alt={`Gambar Soal ${index + 1}`}
                            className="max-w-full h-auto mt-2 rounded-lg shadow-md"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src =
                                "https://via.placeholder.com/300?text=Gambar+tidak+ditemukan";
                            }}
                            style={{ maxHeight: "200px" }}
                          />
                        )}
                        <p className="text-gray-700 mt-2">
                          <span className="font-medium">Jawaban Anda: </span>
                          {text}{" "}
                          <span className="inline-flex items-center ml-2">
                            {isCorrect ? "✅" : "❌"}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => {
                    setExamStarted(false);
                    setNisn("");
                    setNamaSiswa("");
                    setSelectedMapel("");
                    setSelectedMateri("");
                    setSelectedJenisUjian("");
                    setSelectedSheet("");
                    setAnswers({});
                    setCurrentQuestionIndex(0);
                    setScore(null);
                    setSubmitStatus("");
                    setAnsweredQuestions(new Set());
                    setIsVerified(false);
                    setTimeLeft(examDuration);
                    setIsCountingDown(false);
                    setCountdown(5);
                    setIsVerifying(false);
                    setShowConfirmDialog(false);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <BookOpen size={20} />
                  Ulangi Ujian
                </button>
              </div>
            </div>
          ) : (
            <div>
              {questions.length > 0 ? (
                <div className="space-y-6">
                  <div className="bg-blue-100 text-blue-700 p-4 rounded-lg flex justify-between items-center">
                    <span className="font-semibold">Waktu Tersisa:</span>
                    <span className="text-lg font-mono">
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Soal {currentQuestionIndex + 1} dari {questions.length}
                    </h3>
                    <div className="grid gap-4">
                      <div>
                        <p className="text-gray-700">
                          {questions[currentQuestionIndex].soal}
                        </p>
                      </div>
                      {questions[currentQuestionIndex].gambar && (
                        <div>
                          <img
                            src={questions[currentQuestionIndex].gambar}
                            alt="Soal Gambar"
                            className="max-w-full h-auto mt-2 rounded-lg shadow-md"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src =
                                "https://via.placeholder.com/300?text=Gambar+tidak+ditemukan";
                            }}
                            style={{ maxHeight: "200px" }}
                          />
                        </div>
                      )}
                      <div className="grid gap-2">
                        {["opsiA", "opsiB", "opsiC", "opsiD"].map(
                          (option, idx) => (
                            <label
                              key={idx}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="radio"
                                name={`question-${currentQuestionIndex}`}
                                value={String.fromCharCode(65 + idx)}
                                checked={
                                  answers[currentQuestionIndex] ===
                                  String.fromCharCode(65 + idx)
                                }
                                onChange={(e) =>
                                  handleAnswerChange(
                                    currentQuestionIndex,
                                    e.target.value
                                  )
                                }
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="text-gray-700">
                                {String.fromCharCode(65 + idx)}.{" "}
                                {
                                  questions[currentQuestionIndex][
                                    option as keyof QuizQuestion
                                  ]
                                }
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 justify-between">
                    <button
                      onClick={prevQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Sebelumnya
                    </button>
                    {currentQuestionIndex < questions.length - 1 ? (
                      <button
                        onClick={nextQuestion}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Selanjutnya
                      </button>
                    ) : (
                      <button
                        onClick={handleFinishExam}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {isSubmitting && (
                          <Loader2 size={20} className="animate-spin" />
                        )}
                        Selesai Ujian
                      </button>
                    )}
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pilih Soal:
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {questions.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => jumpToQuestion(index)}
                          className={`px-4 py-2 rounded-md text-center ${
                            currentQuestionIndex === index
                              ? "bg-blue-600 text-white"
                              : answeredQuestions.has(index)
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-gray-200 hover:bg-gray-300"
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">Tidak ada soal tersedia.</p>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Konfirmasi Selesai Ujian
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Apakah Anda yakin ingin menyelesaikan ujian?
                  </p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Soal terjawab:</span>{" "}
                  {Object.keys(answers).length} dari {questions.length}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-medium">Waktu tersisa:</span>{" "}
                  {formatTime(timeLeft)}
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelSubmitExam}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={confirmSubmitExam}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Ya, Selesaikan Ujian
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineExam;
