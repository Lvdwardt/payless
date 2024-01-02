import { useEffect, useState } from "react";
import { getArchiveToday, getQuery } from "./helpers";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [archiveLink, setArchiveLink] = useState("");

  useEffect(() => {
    async function fetchData() {
      const query = getQuery(); // get query from url
      setQuery(query);
      const link = await getArchiveToday(query); // get archive link
      setArchiveLink(link);

      // redirect to archive link
      // window.location.href = link;
      if (link) {
        window.location.replace(link);
      }
    }
    fetchData();
  }, []);

  if (!query) {
    return (
      <div className="min-h-screen w-screen">
        <p>No query</p>
      </div>
    );
  }

  return (
    <div>
      <p>Redirecting to archive...</p>
      <p>{archiveLink}</p>
    </div>
  );
}
export default App;
