import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc 
} from "firebase/firestore";

const app = express();
const PORT = 3000;

// Set up body parsers with limits for handling large file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Firebase App for Server-side firestore updates
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, "ai-studio-41e3c325-1ef7-4c09-899c-24b354095751");

// --- Google Drive Helper Functions ---

/**
 * Creates a folder on Google Drive
 */
async function createDriveFolder(accessToken: string, folderName: string, parentId?: string) {
  const metadata: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal membuat folder Google Drive: ${errText}`);
  }

  const data: any = await response.json();
  return data.id;
}

/**
 * Retrieves the Google Drive settings from Firestore, checks if expired, 
 * refreshes the token if needed, and returns the active accessToken and mainFolderId.
 */
async function getDriveToken() {
  const settingsRef = doc(db, "settings", "google_drive");
  const snap = await getDoc(settingsRef);
  if (!snap.exists()) {
    throw new Error("Google Drive belum terhubung. Silakan konfigurasi di menu Admin.");
  }

  const config = snap.data();
  const { clientId, clientSecret, accessToken, refreshToken, expiresAt, mainFolderId } = config;

  // Refresh token if expired or about to expire in less than 60 seconds
  if (!expiresAt || Date.now() > expiresAt - 60000) {
    if (!refreshToken) {
      throw new Error("Refresh token Google Drive tidak ditemukan. Silakan hubungkan kembali akun Google Drive Anda.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Gagal memperbarui token Google Drive: ${errText}`);
    }

    const tokenData: any = await tokenResponse.json();
    const newAccessToken = tokenData.access_token;
    const newExpiresAt = Date.now() + (tokenData.expires_in * 1000);

    // Save fresh token in Firestore
    await updateDoc(settingsRef, {
      accessToken: newAccessToken,
      expiresAt: newExpiresAt
    });

    return {
      accessToken: newAccessToken,
      mainFolderId
    };
  }

  return {
    accessToken,
    mainFolderId
  };
}

/**
 * Uploads a base64 DataURL or text content to Google Drive as a binary file
 */
async function uploadFileToDrive(
  accessToken: string, 
  fileNama: string, 
  fileType: string, 
  fileData: string, 
  parentFolderId: string
) {
  let fileBuffer: Buffer;
  let mimeType = fileType || "application/octet-stream";

  if (fileData.startsWith("data:")) {
    // Binary file represented as DataURL
    const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      fileBuffer = Buffer.from(matches[2], "base64");
    } else {
      fileBuffer = Buffer.from(fileData);
    }
  } else {
    // Plain text / code file
    fileBuffer = Buffer.from(fileData, "utf-8");
    if (!mimeType.startsWith("text/")) {
      mimeType = "text/plain";
    }
  }

  const metadata = {
    name: fileNama,
    parents: [parentFolderId]
  };

  const boundary = "multipart_upload_boundary_tugas_kuliah";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": `multipart/related; boundary=${boundary}`
  };

  // Build the multipart body using Buffer to prevent binary corruption
  const part1 = Buffer.from(
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    "Content-Transfer-Encoding: binary\r\n\r\n"
  );
  const part2 = fileBuffer;
  const part3 = Buffer.from(closeDelim);

  const body = Buffer.concat([part1, part2, part3]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers,
    body
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengunggah file ke Google Drive: ${errText}`);
  }

  return await response.json();
}

// --- API Routes ---

// Get current Google Drive Config Status
app.get("/api/drive/config", async (req, res) => {
  try {
    const settingsRef = doc(db, "settings", "google_drive");
    const snap = await getDoc(settingsRef);
    const envKeys = Object.keys(process.env).filter(key => key.includes("GOOGLE") || key.includes("OAUTH") || key.includes("CLIENT") || key.includes("SECRET") || key.includes("APP"));
    const suggestedClientId = firebaseConfig.oAuthClientId || "";
    if (snap.exists()) {
      const data = snap.data();
      res.json({
        connected: true,
        email: data.email || "Akun Terhubung",
        clientId: data.clientId,
        mainFolderId: data.mainFolderId,
        connectedAt: data.connectedAt,
        envKeys,
        suggestedClientId
      });
    } else {
      res.json({ connected: false, envKeys, suggestedClientId });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save client ID & Client Secret
app.post("/api/drive/save-credentials", async (req, res) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: "Client ID dan Client Secret wajib diisi." });
  }

  try {
    const settingsRef = doc(db, "settings", "google_drive");
    const snap = await getDoc(settingsRef);
    
    const existingData = snap.exists() ? snap.data() : {};
    
    await setDoc(settingsRef, {
      ...existingData,
      clientId,
      clientSecret
    }, { merge: true });

    res.json({ success: true, message: "Kredensial Google OAuth berhasil disimpan." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Swap OAuth Authorization Code for tokens
app.post("/api/drive/token", async (req, res) => {
  const { code, redirectUri } = req.body;
  if (!code || !redirectUri) {
    return res.status(400).json({ error: "Code dan Redirect URI wajib disediakan." });
  }

  try {
    const settingsRef = doc(db, "settings", "google_drive");
    const snap = await getDoc(settingsRef);
    if (!snap.exists()) {
      return res.status(400).json({ error: "Harap simpan Client ID dan Client Secret terlebih dahulu." });
    }

    const config = snap.data();
    const { clientId, clientSecret } = config;

    // Exchange auth code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return res.status(400).json({ error: `Gagal menukar kode otorisasi Google: ${errText}` });
    }

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || config.refreshToken;
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);

    if (!refreshToken) {
      return res.status(400).json({ 
        error: "Google tidak mengirimkan Refresh Token. Harap hapus izin aplikasi ini dari akun Google Anda dan hubungkan kembali untuk memberikan persetujuan penuh." 
      });
    }

    // Get email from UserInfo API
    const infoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    let email = "Akun Google Drive";
    if (infoResponse.ok) {
      const infoData: any = await infoResponse.json();
      email = infoData.email;
    }

    // Create main master folder inside Google Drive
    let mainFolderId = config.mainFolderId;
    if (!mainFolderId) {
      mainFolderId = await createDriveFolder(accessToken, "Pengumpulan Tugas FIP");
    }

    // Save tokens and settings in Firestore
    await setDoc(settingsRef, {
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      expiresAt,
      email,
      mainFolderId,
      connectedAt: new Date().toISOString()
    });

    res.json({ success: true, email, mainFolderId });
  } catch (error: any) {
    console.error("Kesalahan pertukaran token Google:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create Google Drive Folder manually/automatically for a Course
app.post("/api/drive/create-course-folder", async (req, res) => {
  const { courseId, courseNama } = req.body;
  if (!courseId || !courseNama) {
    return res.status(400).json({ error: "courseId dan courseNama wajib disediakan." });
  }

  try {
    const { accessToken, mainFolderId } = await getDriveToken();
    const folderId = await createDriveFolder(accessToken, courseNama, mainFolderId);

    // Save the folderId to the course document in Firestore
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, {
      driveFolderId: folderId
    });

    res.json({ success: true, folderId });
  } catch (error: any) {
    console.error("Gagal membuat folder kelas:", error);
    res.status(500).json({ error: error.message });
  }
});

// Upload File Submission to Google Drive
app.post("/api/drive/upload-submission", async (req, res) => {
  const { 
    submissionId, 
    fileNama, 
    fileType, 
    fileData, 
    courseId, 
    courseNama, 
    assignmentJudul, 
    studentNim, 
    studentNama 
  } = req.body;

  if (!submissionId || !fileNama || !fileData || !courseId) {
    return res.status(400).json({ error: "Parameter pengunggahan tidak lengkap." });
  }

  try {
    const { accessToken, mainFolderId } = await getDriveToken();

    // Check if the Course has a driveFolderId
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef);
    let driveFolderId = "";

    if (courseSnap.exists()) {
      const courseData = courseSnap.data();
      driveFolderId = courseData.driveFolderId || "";
    }

    // If no course folder exists in Google Drive yet, create it on-demand
    if (!driveFolderId) {
      driveFolderId = await createDriveFolder(accessToken, courseNama || "Kelas Tidak Diketahui", mainFolderId);
      await updateDoc(courseRef, {
        driveFolderId
      });
    }

    // Format a highly organized name: [TugasJudul]_[NIM]_[NamaMahasiswa]_NamaFileAsli
    const sanitizedTitle = (assignmentJudul || "Tugas").replace(/[^a-zA-Z0-9_\-]/g, "_");
    const sanitizedStudentName = (studentNama || "Mahasiswa").replace(/[^a-zA-Z0-9_\- ]/g, "_");
    const driveFileNama = `[${sanitizedTitle}]_[${studentNim || "NIM"}]_[${sanitizedStudentName}]_${fileNama}`;

    // Upload the file binary/base64 to Google Drive
    const uploadResult = await uploadFileToDrive(
      accessToken,
      driveFileNama,
      fileType,
      fileData,
      driveFolderId
    );

    // Update Submission document in Firestore with drive URLs
    const submissionRef = doc(db, "submissions", submissionId);
    await updateDoc(submissionRef, {
      driveFileId: uploadResult.id,
      driveFileUrl: uploadResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}/view?usp=drivesdk`
    });

    res.json({ 
      success: true, 
      fileId: uploadResult.id, 
      fileUrl: uploadResult.webViewLink 
    });
  } catch (error: any) {
    console.error("Gagal mengunggah pengumpulan tugas ke Google Drive:", error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect/Reset Google Drive connection
app.post("/api/drive/disconnect", async (req, res) => {
  try {
    const settingsRef = doc(db, "settings", "google_drive");
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      await setDoc(settingsRef, {}); // Reset settings
      res.json({ success: true, message: "Koneksi Google Drive berhasil diputuskan." });
    } else {
      res.json({ success: true, message: "Google Drive sudah dalam keadaan tidak terhubung." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Vite & Client Side Handlers ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server full-stack berjalan di port ${PORT}`);
    console.log("Process Env Keys:", Object.keys(process.env).filter(key => key.includes("GOOGLE") || key.includes("OAUTH") || key.includes("CLIENT") || key.includes("SECRET") || key.includes("APP") || key.includes("PORT")));
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
