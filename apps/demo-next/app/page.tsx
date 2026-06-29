export default function HomePage() {
  return (
    <iframe
      src="/index.html"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
      }}
      title="AISplinter"
    />
  );
}
