import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Leer el archivo de clave directamente
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

// Leer el contenido del JSON
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();
console.log("✅ Firebase conectado correctamente");
