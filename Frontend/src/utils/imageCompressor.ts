/**
 * Utility to compress images in the browser using HTML5 Canvas.
 * Aims for a file size under 100KB while maintaining reasonable quality.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with quality adjustment
        // We start with quality and if it's still too big, we could potentially retry, 
        // but 0.7 at 1200px is usually < 100KB.
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // If blob is still > 150KB and we have high quality, try one more time at lower quality
              if (blob.size > 150000 && quality > 0.4) {
                 compressImage(file, maxWidth - 200, quality - 0.2).then(resolve).catch(reject);
              } else {
                 resolve(blob);
              }
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
}
