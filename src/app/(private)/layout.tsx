import PrivateSidebar from "./private-sidebar";

export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="d-flex flex-column flex-md-row vh-100 overflow-hidden bg-light">
      <PrivateSidebar />
      <div className="flex-grow-1 overflow-auto px-3 px-md-4 py-3 py-md-4">
        <div className="container-xxl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
