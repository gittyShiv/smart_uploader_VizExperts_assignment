import Uploader from "./uploader";
import "./styles.css";

export default function App() {
  return (
    <div className="page-shell">
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      <Uploader />
    </div>
  );
}
