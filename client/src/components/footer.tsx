import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="fixed bottom-0 right-0 p-4 text-sm text-muted-foreground">
      <span>
        Developed by{" "}
        <a
          href="https://nellainteractive.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          NELLA Interactive
        </a>
      </span>
    </footer>
  );
}
