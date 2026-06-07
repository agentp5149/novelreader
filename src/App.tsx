import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { SearchPage } from "./pages/SearchPage";
import { LibraryPage } from "./pages/LibraryPage";
import { NovelPage } from "./pages/NovelPage";
import { ReaderPage } from "./pages/ReaderPage";

export function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">Library</Link>
        <Link to="/search">Search</Link>
      </nav>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/novel/:slug" element={<NovelPage />} />
        <Route path="/read/:novelSlug/*" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
