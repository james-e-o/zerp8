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

export async function uploadImagesToSupabase(files, { bucket, companyName, folder, owner }, replaceImage) {
  const results = [];

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

    // Build storage path including optional folder
    const safeCompany = companyName ? companyName.replace(/\s+/g, '_') : 'company';
    const safeFolder = folder ? `${folder.replace(/\s+/g, '_')}/` : '';
    const fullPath = `${safeCompany}/${safeFolder}${fileObj.name}`;

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
        owner: owner,
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

