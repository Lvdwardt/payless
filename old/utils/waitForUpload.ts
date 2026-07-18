//if an article isn't uploaded yet, wait for it to be uploaded
export default async function waitForUpload(baseURL: string, query: string) {
  const startUpload = await fetch(`${baseURL}/api/upload?query=${query}`).then(
    (res) => res.text()
  );
  console.log(startUpload);
}
