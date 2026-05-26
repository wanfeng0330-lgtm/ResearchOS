export async function generateImage(prompt: string, size: string = '1024x1024'): Promise<string> {
  const apiKey = process.env.IMAGE_API_KEY || ''
  if (!apiKey) {
    console.error('[ImageService] IMAGE_API_KEY is not configured')
    return ''
  }

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen-Image-2.0',
        prompt,
        image_size: size,
        num_inference_steps: 20,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ImageService] API error: ${response.status} - ${errorText}`)
      return ''
    }

    const data = await response.json()
    const imageUrl = data.images?.[0]?.url || data.data?.[0]?.url || ''
    return imageUrl
  } catch (error) {
    console.error('[ImageService] Failed to generate image:', error)
    return ''
  }
}
