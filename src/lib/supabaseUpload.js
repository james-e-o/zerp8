import supabase from "../config/supabaseClient";

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

export async function uploadImagesToSupabase(files, { bucket, slug, folder, company }, replaceImage) {
  const results = [];

  if (!slug?.trim()) {
    const error = new Error('Company slug is required for image upload');
    return files.map(() => ({ data: null, error, path: null }));
  }

  for (const item of files) {
    let fileObj = item.file;

    // If the library provided a data URL instead of a File, convert it
    if (!fileObj && item.data_url) {
      try {
        const name = item.fileName || `upload_${Date.now()}.png`;
        fileObj = dataURLtoFile(item.data_url, name);
      } catch (err) {
        results.push({ data: null, error: new Error('Failed to convert data_url to File'), path: null });
        continue;
      }
    }

    // Validate file
    if (!(fileObj instanceof File) || !fileObj.type?.startsWith("image/")) {
      results.push({ data: null, error: new Error("Invalid file or not an image"), path: null });
      continue;
    }

    // Build storage path using the company's slug (matches RLS policy exactly)
    const safeFolder = folder ? `${folder.replace(/\s+/g, '_')}/` : '';
    const fullPath = `${slug}/${safeFolder}${fileObj.name}`;
    console.log('Uploading to Supabase:', fullPath);

    try {
      const { data, error } = await supabase.storage.from(bucket).upload(fullPath, fileObj, { upsert: replaceImage });

      if (error) {
        console.error('Supabase storage upload error:', error, { fullPath, bucket });
        results.push({ data: null, error, path: fullPath });
        continue;
      }

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
      const publicUrl = publicData?.publicUrl || null;
  

      // Insert into images table following your exact schema
      const { data: images, error: imagesError } = await supabase.from('images').insert({
        id: data?.id,
        company,
        name: fileObj.name,
        folder: folder || null,
        storage: bucket,
        url: publicUrl,
        path: fullPath,
        size: fileObj.size,
        mime_type: fileObj.type,
      });

      if (imagesError) {
        console.error('DB Insert Error:', imagesError);
      }

      results.push({ data, error: null, url: publicUrl, path: fullPath, folder: folder || null });
    } catch (err) {
      console.error('Unexpected upload error:', err, { fullPath, bucket });
      results.push({ data: null, error: err, path: fullPath });
    }
  }

  return results;
}