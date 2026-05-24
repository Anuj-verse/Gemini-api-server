require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(cors());
app.use(express.json());

const apiKeys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];
let currentKeyIndex = 0;

function getNextApiKey() {
  if (apiKeys.length === 0) {
    throw new Error("No Gemini API keys found");
  }
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
}

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      // Set header to plain text for errors to keep output formatting consistent
      res.setHeader("Content-Type", "text/plain");
      return res.status(400).send("Error: Prompt is required\n");
    }

    let responseText;
    
    // Initialize genAI with the next rotated API key
    const apiKey = getNextApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
      // Primary Attempt: Try Gemini 3.5 Flash
      const primaryModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      const result = await primaryModel.generateContent(prompt);
      responseText = result.response.text();
    } catch (primaryError) {
      console.warn("Primary model overloaded. Switching to fallback model...", primaryError.message);
      
      // Fallback Attempt: Try Gemini 3.1 Flash if 3.5 experiences heavy loads
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.1-flash" });
      const result = await fallbackModel.generateContent(prompt);
      responseText = result.response.text();
    }

    // Set the response header to plain text so the terminal renders markdown natively
    res.setHeader("Content-Type", "text/plain");
    
    // Send the text along with a trailing newline for clean terminal presentation
    res.send(`${responseText}\n`);

  } catch (error) {
    console.error(error);
    res.setHeader("Content-Type", "text/plain");
    res.status(500).send(`Error: Something went wrong. ${error.message}\n`);
  }
});

app.get("/", (req, res) => {
  res.send("Gemini API Server Running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});