export default function Loader() {
  return (
    <div className="flex gap-2">
      <span className="sr-only">Loading...</span>
      <div className="h-8 w-8 rounded-full animate-bounce [animation-delay:-0.3s] bg-[#A96CDA]"></div>
      <div className="h-8 w-8 rounded-full animate-bounce [animation-delay:-0.15s] bg-[#A96CDA]"></div>
      <div className="h-8 w-8 rounded-full animate-bounce bg-[#A96CDA]"></div>
    </div>
  );
}
