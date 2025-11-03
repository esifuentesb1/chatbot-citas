// --- Dependencias principales ---
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, updateDoc } from "firebase/firestore";

dotenv.config();
const app = express();
app.use(express.json());

// --- Ruta de prueba para verificar el servidor ---
app.get("/", (req, res) => {
  res.send("🚀 Servidor del chatbot funcionando correctamente.");
});

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// --- Inicializar horarios en Firestore si no existen ---
async function inicializarHorarios() {
  const horariosRef = collection(db, "horarios");
  const snapshot = await getDocs(horariosRef);

  if (snapshot.empty) {
    console.log("⚙️ No hay horarios, creando por defecto...");

    const listaHorarios = [
      { id: "1", hora: "09:00 AM", disponible: true },
      { id: "2", hora: "10:00 AM", disponible: true },
      { id: "3", hora: "11:00 AM", disponible: true },
      { id: "4", hora: "02:00 PM", disponible: true },
      { id: "5", hora: "03:00 PM", disponible: true },
    ];

    for (const horario of listaHorarios) {
      await setDoc(doc(db, "horarios", horario.id), horario);
    }

    console.log("✅ Horarios creados correctamente en Firestore.");
  } else {
    console.log("✅ Los horarios ya existen en Firestore.");
  }
}

// --- Función para enviar mensajes por WhatsApp ---
async function enviarMensaje(numero, texto) {
  const url = `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`;

  const cuerpo = {
    messaging_product: "whatsapp",
    to: numero,
    text: { body: texto },
  };

  const opciones = {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  };

  const respuesta = await fetch(url, opciones);
  const data = await respuesta.json();

  if (!respuesta.ok) {
    console.error("❌ Error al enviar mensaje:", data);
  } else {
    console.log("✅ Mensaje enviado a:", numero);
  }
}

// --- Webhook para verificar token ---
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("🟢 Webhook verificado correctamente.");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- Webhook para recibir mensajes ---
app.post("/webhook", async (req, res) => {
  const entry = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (entry) {
    const numero = entry.from;
    const texto = entry.text?.body?.toLowerCase();

    console.log("💬 Mensaje recibido:", texto);

    if (texto.includes("hola")) {
      await enviarMensaje(numero, "👋 ¡Hola! Soy tu asistente virtual. Escribe 'horarios' para ver los disponibles.");
    }

    else if (texto.includes("horarios")) {
      const horariosRef = collection(db, "horarios");
      const snapshot = await getDocs(horariosRef);

      let lista = "🕒 Horarios disponibles:\n";
      snapshot.forEach(doc => {
        const h = doc.data();
        if (h.disponible) lista += `- ${h.hora}\n`;
      });

      await enviarMensaje(numero, lista || "❌ No hay horarios disponibles por el momento.");
    }

    else if (texto.includes("reservar")) {
      const horariosRef = collection(db, "horarios");
      const snapshot = await getDocs(horariosRef);

      const primerHorario = snapshot.docs.find(d => d.data().disponible);
      if (primerHorario) {
        await updateDoc(doc(db, "horarios", primerHorario.id), { disponible: false });
        await enviarMensaje(numero, `✅ Reservaste la cita de las ${primerHorario.data().hora}. ¡Te esperamos!`);
      } else {
        await enviarMensaje(numero, "❌ No hay horarios disponibles para reservar.");
      }
    }

    else {
      await enviarMensaje(numero, "🤖 No entendí tu mensaje. Escribe 'hola' o 'horarios'.");
    }
  }

  res.sendStatus(200);
});

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  await inicializarHorarios();
});

