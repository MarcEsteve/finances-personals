const canvas = document.getElementById("canvas");
const stream = canvas.captureStream(60); // 60 FPS

const recorder = new MediaRecorder(stream, {
  mimeType: "video/webm"
});

const chunks = [];

recorder.ondataavailable = e => chunks.push(e.data);

recorder.onstop = () => {
  const blob = new Blob(chunks, { type: "video/webm" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "animacion.webm";
  a.click();
};

recorder.start();

// grabar durante 10 segundos
setTimeout(() => recorder.stop(), 10000);