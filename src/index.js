import React from "react";
import ReactDOM from "react-dom/client";  // ✅ Use createRoot
import { MantineProvider } from "@mantine/core";
import App from "./App";
import 'bootstrap/dist/css/bootstrap.css';

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <MantineProvider withGlobalStyles withNormalizeCSS>
    <App />
  </MantineProvider>
);
