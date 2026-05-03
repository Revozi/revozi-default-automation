const replicate = require('./replicateClient');
const axios = require('axios');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

const KLING_VIDEO_URL = 'https://api.replicate.com/v1/models/kwaivgi/kling-v1.6-standard/predictions';
const DEFAULT_KLING_NEGATIVE_PROMPT = [
  'low quality',
  'blurry',
  'flicker',
  'jitter',
  'warped UI',
  'unreadable text',
  'subtitles',
  'captions',
  'watermark',
  'logo',
  'brand names',
  'distorted hands',
  'duplicate people',
  'deformed faces',
  'glitch artifacts'
].join(', ');

function normalizeVideoOptions(startImageOrOptions, maybeOptions) {
  if (
    startImageOrOptions &&
    typeof startImageOrOptions === 'object' &&
    !Array.isArray(startImageOrOptions)
  ) {
    return { ...startImageOrOptions };
  }

  return {
    ...(startImageOrOptions ? { startImage: startImageOrOptions } : {}),
    ...(maybeOptions || {})
  };
}

function normalizeKlingDuration(duration) {
  const seconds = Number(duration);
  return seconds >= 10 ? 10 : 5;
}

// 🕒 Poll prediction status until success/fail
const waitForReplicatePrediction = async (predictionId, maxWait = 300) => {
  const interval = 5000;
  const maxAttempts = Math.ceil(maxWait * 1000 / interval);
  let attempts = 0;

  while (attempts < maxAttempts) {
    const res = await replicate.get(`/predictions/${predictionId}`);
    const prediction = res.data;

    if (prediction.status === 'succeeded') {
      const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return output;
    }

    if (prediction.status === 'failed') {
      throw new Error('Replicate generation failed');
    }

    await new Promise(resolve => setTimeout(resolve, interval));
    attempts++;
  }

  throw new Error('Replicate generation timed out');
};

// 🖼️ Image generation (SDXL)// Generate SDXL image (using model slug)

const generateImageFromPrompt = async (
  prompt,
  options = {}
) => {
  const {
    width = 1024,
    height = 1024,
    refine = "expert_ensemble_refiner",
    negative_prompt = "",
    guidance_scale = 7.5,
    prompt_strength = 0.8,
    num_inference_steps = 25
  } = options;

  try {
    const response = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        input: {
          prompt,
          width,
          height,
          refine,
          negative_prompt,
          guidance_scale,
          prompt_strength,
          apply_watermark: false,
          num_inference_steps
        }
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        }
      }
    );

    const output = Array.isArray(response.data.output)
      ? response.data.output[0]
      : response.data.output;

    return output;
  } catch (err) {
    console.error('[REPLICATE][IMAGE_GEN] Error:', err.response?.data || err.message);
    throw new Error('Image generation failed');
  }
};



// 🎥 Video generation (Kling v1.6, with optional start_image)

const generateVideoFromPrompt = async (prompt, startImageOrOptions = null, maybeOptions = {}) => {
  const {
    startImage = null,
    duration = process.env.REPLICATE_VIDEO_DURATION || 10,
    aspectRatio = process.env.REPLICATE_VIDEO_ASPECT_RATIO || '16:9',
    cfgScale = Number(process.env.REPLICATE_VIDEO_CFG_SCALE || 0.7),
    negativePrompt = DEFAULT_KLING_NEGATIVE_PROMPT,
    referenceImages = []
  } = normalizeVideoOptions(startImageOrOptions, maybeOptions);

  try {
    const response = await axios.post(
      KLING_VIDEO_URL,
      {
        input: {
          prompt,
          duration: normalizeKlingDuration(duration),
          cfg_scale: cfgScale,
          negative_prompt: negativePrompt,
          ...(startImage && { start_image: startImage }),
          ...(!startImage && aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          ...(Array.isArray(referenceImages) && referenceImages.length
            ? { reference_images: referenceImages.slice(0, 4) }
            : {})
        }
      },
      {
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait'
        }
      }
    );

    const data = response.data;

    // Handle cases where Replicate doesn't return an output immediately
    if (!data || !data.id || !data.output) {
      console.warn('[REPLICATE][VIDEO_GEN] Initial response missing output, will poll...');
      const output = await waitForReplicatePrediction(data.id);
      if (!output) throw new Error('Invalid video output from Replicate after polling');
      return output;
    }

    const output = Array.isArray(data.output) ? data.output[0] : data.output;

    if (!output) {
      console.error('[REPLICATE][VIDEO_GEN] Invalid or empty output:', data);
      throw new Error('Invalid video output from Replicate');
    }

    return output;
  } catch (err) {
    const reason = err.response?.data?.error || err.message || 'Unknown error';
    console.error('[REPLICATE][VIDEO_GEN] Error:', reason);
    throw new Error('Video generation failed');
  }
};



module.exports = {
  generateImageFromPrompt,
  generateVideoFromPrompt
};
