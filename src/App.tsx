import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { LibraryPage } from "./pages/LibraryPage";
import { NovelPage } from "./pages/NovelPage";
import { ReaderPage } from "./pages/ReaderPage";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link active" : "nav-link";

export function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <NavLink to="/" className="brand">
          NovelReader
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/library" className={linkClass}>
            Library
          </NavLink>
          <NavLink to="/search" className={linkClass}>
            Search
          </NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/novel/:slug" element={<NovelPage />} />
        <Route path="/read/:novelSlug/*" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
