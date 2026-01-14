

import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { GoogleGenAI } from '@google/genai';


const fontPath = path.join(process.cwd(), 'public', 'fonts', 'fonted.otf');
const coverPath = path.join(process.cwd(), 'public', 'cover.png');

registerFont(fontPath, { family: 'def' });


async function pixabayImageSearch(query, limit = 6) {
  const API_KEY = process.env.PIXABAY_API; 
  
  if (!API_KEY) {
    throw new Error('PIXABAY_API environment variable is not set');
  }
  
  
  const cleanQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '+');
  
  const url = `https://pixabay.com/api/?key=${API_KEY}&q=${cleanQuery}&image_type=photo&per_page=${limit}&safesearch=true`;
  
  console.log(`Pixabay search: "${cleanQuery}"`);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pixabay error response:', errorText);
      throw new Error(`Pixabay API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.hits || data.hits.length === 0) {
      console.warn(`No images found for "${cleanQuery}", FALLBACK!`);
      
      return pixabayImageSearchFallback(limit);
    }
    
    console.log(`${data.hits.length} images`);
    return data.hits.map(img => img.largeImageURL);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Pixabay timeout');
    }
    throw error;
  }
}


async function pixabayImageSearchFallback(limit = 6) {
  const fallbackTerms = ['nature', 'abstract', 'landscape', 'technology', 'science', 'art'];
  const randomTerm = fallbackTerms[Math.floor(Math.random() * fallbackTerms.length)];
  
  console.log(`fallback search: "${randomTerm}"`);
  
  const API_KEY = process.env.PIXABAY_API; 
  const url = `https://pixabay.com/api/?key=${API_KEY}&q=${randomTerm}&image_type=photo&per_page=${limit}&safesearch=true`;
  
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000)
  });
  
  if (!response.ok) {
    throw new Error(`Pixabay fallback also failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.hits.map(img => img.largeImageURL);
}


function getTextColor(ctx, width, height, position = 'bottom') {
  try {
    const sampleY = position === 'bottom' ? height - 10 : 10;
    const sample = ctx.getImageData(width / 2, sampleY, 1, 1).data;
    const [r, g, b] = sample;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? 'black' : 'white';
  } catch {
    return 'white';
  }
}

function wrapTextLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line.trim());
      line = w + ' ';
    } else {
      line = test;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

async function drawPostImage(backgroundUrl, text, position = 'bottom') {
  
  const response = await fetch(backgroundUrl);
  const bgBuffer = Buffer.from(await response.arrayBuffer());

  const bg = await loadImage(bgBuffer);
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const scale = Math.max(width / bg.width, height / bg.height);
  const newW = bg.width * scale;
  const newH = bg.height * scale;
  const dx = (width - newW) / 2;
  const dy = (height - newH) / 2;
  ctx.drawImage(bg, dx, dy, newW, newH);

  const fadeHeight = height * 0.45;

  if (position === 'bottom') {
    const grad = ctx.createLinearGradient(0, height - fadeHeight, 0, height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.2, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, height - fadeHeight, width, fadeHeight);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, fadeHeight);
    grad.addColorStop(0, 'rgba(0,0,0,0.8)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, fadeHeight);
  }

  const maxWidth = width * 0.8;
  let fontSize = 35;
  const minFont = 16;
  let lines = [];
  while (fontSize >= minFont) {
    ctx.font = `${fontSize}px def`;
    lines = wrapTextLines(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.2;
    if (lines.length * lineHeight <= fadeHeight * 0.9) break;
    fontSize -= 2;
  }

  const lineHeight = fontSize * 1.2;
  const textHeight = lines.length * lineHeight;
  const startY = position === 'bottom'
    ? height - fadeHeight + (fadeHeight - textHeight) / 2
    : (fadeHeight - textHeight) / 3;

  ctx.fillStyle = "white";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = fontSize * 0.8;

  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight);
  });

  return canvas.toBuffer('image/png');
}

async function drawCoverImage(text) {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const cover = await loadImage(coverPath);
  ctx.drawImage(cover, 0, 0, width, height);

  const maxWidth = width * 0.8;
  let fontSize = 60;
  const minFont = 20;
  let lines = [];

  while (fontSize >= minFont) {
    ctx.font = `bold ${fontSize}px def`;
    lines = wrapTextLines(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.2;
    if (lines.length * lineHeight <= height * 0.8) break;
    fontSize -= 2;
  }

  const lineHeight = fontSize * 1.2;
  const textHeight = lines.length * lineHeight;
  const startY = (height - textHeight) / 2;

  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = fontSize * 0.8;

  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight);
  });

  return canvas.toBuffer('image/png');
}


async function generateText(prompt) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  if (resp.text) return resp.text;
  if (resp.contents?.[0]?.parts?.[0]?.text) return resp.contents[0].parts[0].text;
  if (resp.contents?.[0]?.text) return resp.contents[0].text;

  console.log('Full Gemini response:', resp);
  throw new Error('No text returned from Gemini');
}


async function uploadToPublicHost(buffer, fileName) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  
  if (!cloudName || !uploadPreset) {
    throw new Error('Missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET');
  }

  
  const base64 = buffer.toString('base64');
  const dataURI = `data:image/png;base64,${base64}`;

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log('Uploading to:', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: dataURI,
      upload_preset: uploadPreset,
    }),
  });

  const json = await res.json();

  if (!json.secure_url) {
    console.error('Cloudinary full error:', json);
    throw new Error(`Cloudinary error: ${json.error?.message || JSON.stringify(json)}`);
  }

  console.log('Upload successful:', json.secure_url);
  return json.secure_url;
}


async function publishToInstagram(imageBuffers, caption) {
  console.log('Uploading images');
  const publicUrls = [];
  
  for (let i = 0; i < imageBuffers.length; i++) {
    const fileName = i === 0 ? 'cover.png' : `output_post_${i}.png`;
    const url = await uploadToPublicHost(imageBuffers[i], fileName);
    publicUrls.push(url);
    console.log(`Uploaded image ${i + 1}/${imageBuffers.length}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Creating Instagram media conts');
  const uploadedIds = [];
  
  for (const url of publicUrls) {
    const res = await fetch(
      `https://graph.instagram.com/v24.0/${process.env.IG_USER_ID}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.IG_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          image_url: url,
          is_carousel_item: true
        })
      }
    );

    const data = await res.json();
    
    if (!data.id) {
      throw new Error(`Failed to create media container: ${JSON.stringify(data)}`);
    }
    
    uploadedIds.push(data.id);
    console.log(`Instagram ID: ${data.id}`);
    await new Promise(r => setTimeout(r, 2000)); 
  }

  
  console.log('Waiting');
  await new Promise(r => setTimeout(r, 10000)); 

  console.log('Carousel cont');
  const carouselRes = await fetch(
    `https://graph.instagram.com/v24.0/${process.env.IG_USER_ID}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.IG_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: uploadedIds.join(','),
        caption: caption
      })
    }
  );

  const carouselData = await carouselRes.json();
  
  if (!carouselData.id) {
    throw new Error(`Failed to create carousel: ${JSON.stringify(carouselData)}`);
  }

  console.log(`Carousel container: ${carouselData.id}`);
  
  
  console.log('Waiting');
  await new Promise(r => setTimeout(r, 5000)); 

  
  let attempts = 0;
  const maxAttempts = 5;
  let publishData;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Try ${attempts}/${maxAttempts}...`);
    
    const publishResponse = await fetch(
      `https://graph.instagram.com/v24.0/${process.env.IG_USER_ID}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: process.env.IG_ACCESS_TOKEN
        })
      }
    );

    publishData = await publishResponse.json();

    if (publishResponse.ok && publishData.id) {
      console.log('published!');
      console.log('ID:', publishData.id);
      return publishData.id;
    }

    
    if (publishData.error?.error_subcode === 2207027) {
      console.log(`not ready`);
      await new Promise(r => setTimeout(r, 10000)); 
    } else {
      
      throw new Error(
        `Failed to publish carousel: ${publishResponse.status} ${JSON.stringify(publishData)}`
      );
    }
  }

  
  throw new Error(
    `Failed to publish carousel after ${maxAttempts} attempts: ${JSON.stringify(publishData)}`
  );
}


export async function generateAndPost() {
  
  const requiredEnvVars = [
    'PIXABAY_API', 
    'GEMINI_API_KEY', 
    'IG_USER_ID', 
    'IG_ACCESS_TOKEN',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_UPLOAD_PRESET'
  ];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  
  if (!fs.existsSync(coverPath)) {
    throw new Error(`Cover image not found at: ${coverPath}`);
  }
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font file not found at: ${fontPath}`);
  }

  const prompt = `Generate me a post on any random but deep, unknown topic. Format your response EXACTLY as follows with --- separators:

[single word for image search]
---
[engaging title]
---
[paragraph 1]
---
[paragraph 2]
---
[paragraph 3]
---
[paragraph 4]
---
[paragraph 5]
---
[paragraph 6]
---
[short engaging caption for Instagram post, 1-2 sentences]
---
[5 relevant hashtags separated by spaces, starting with #]

Make it interesting and educational!`;

  console.log('Generating text');
  const fullText = await generateText(prompt);
  const paragraphs = fullText.split('---').map(p => p.trim()).filter(Boolean);
  
  if (paragraphs.length < 10) {
    console.error('Gemini response:', fullText);
    throw new Error(`Expected at least 10 pars, got ${paragraphs.length}`);
  }
  
  console.log(`content: "${paragraphs[1]}"; keyword: "${paragraphs[0]}"`);

  
  const coverBuffer = await drawCoverImage(paragraphs[1]);

  
  const imageUrls = await pixabayImageSearch(paragraphs[0], 6);
  if (imageUrls.length < 6) {
    throw new Error(`Only ${imageUrls.length} images found, need 6`);
  }

  
  const imageBuffers = [coverBuffer];
  
  for (let i = 0; i < 6; i++) {
    const position = i % 2 === 0 ? 'bottom' : 'top';
    const imgBuffer = await drawPostImage(imageUrls[i], paragraphs[i + 2], position);
    imageBuffers.push(imgBuffer);
    console.log(`Generated image ${i + 1}/6`);
  }

  
  const caption = `${paragraphs[8]}\n\n${paragraphs[9]}`;
  console.log('Caption:', caption);

  
  const postId = await publishToInstagram(imageBuffers, caption);

  return { 
    title: paragraphs[1], 
    imageWord: paragraphs[0],
    caption: paragraphs[8],
    hashtags: paragraphs[9],
    postId 
  };
}