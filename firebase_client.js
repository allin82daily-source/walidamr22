// Minimal Firebase v9 modular example (client-side)
// Install @firebase/app, @firebase/storage, @firebase/firestore via CDN or bundler

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getStorage, ref as sRef, uploadString, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { getFirestore, doc, setDoc, getDoc, query, where, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);
const auth = getAuth(app);

// Generate code client-side or server-side
function generateCode(len = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i =0;i<len;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}

// Upload example (file input)
async function uploadFile(file, type, makePublic=false) {
  const code = generateCode(6);
  const path = `files/${code}/${file.name}`;
  const storageRef = sRef(storage, path);

  // add owner metadata (if authenticated)
  const owner = auth.currentUser ? auth.currentUser.uid : null;
  const metadata = { customMetadata: { owner: owner || "", public: makePublic ? "true" : "false" } };

  // upload bytes
  await uploadBytes(storageRef, file, metadata);

  // store Firestore metadata
  await setDoc(doc(db, "files", code), {
    code,
    name: file.name,
    type,
    storagePath: path,
    public: makePublic,
    owner: owner || null,
    createdAt: new Date()
  });

  return code;
}

// Download/preview
async function getFileByCode(code) {
  const docRef = doc(db, "files", code);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const meta = snap.data();
  const fileRef = sRef(storage, meta.storagePath);
  const url = await getDownloadURL(fileRef);
  return { meta, url };
}