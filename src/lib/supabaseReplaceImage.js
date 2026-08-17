import supabase from "../config/supabaseClient";

export async function replaceImageInSupabase(
  oldId,
  oldPath,
  bucket,
  newFile,
  { companyName, folder, owner }
) {
  try {
    // 1️⃣ Upload new image (upsert: true)
    const newFullPath = `${companyName}/${newFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(newFullPath, newFile, { upsert: true });

    if (uploadError) return { success: false, error: uploadError };

    // 2️⃣ Get public URL of new image
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(newFullPath);

    // 3️⃣ Update the images table for the existing image row
    const { data: updatedImage, error: imagesError } = await supabase
      .from("images")
      .update({
        name: newFile.name,
        folder: folder || null,
        url: publicUrl,
        path: newFullPath,
        size: newFile.size,
        mime_type: newFile.type,
        owner,
      })
      .eq("id", oldId);

    if (imagesError) return { success: false, error: imagesError };

    // 4️⃣ Update the products table wherever old image URL was used
    // await supabase
    //   .from("products")
    //   .update({ image_url: publicUrl })
    //   .eq("image_url", oldPath);

    // ✅ Done
    return { success: true, data: updatedImage, newUrl: publicUrl };

  } catch (err) {
    return { success: false, error: err };
  }
}

