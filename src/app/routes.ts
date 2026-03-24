import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { HomePage } from "./pages/HomePage";
import { ChatListPage } from "./pages/ChatListPage";
import { ChatRoomPage } from "./pages/ChatRoomPage";
import { CreatePage } from "./pages/CreatePage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProfilePage } from "./pages/ProfilePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomePage },
      { path: "chat", Component: ChatListPage },
      { path: "chat/:id", Component: ChatRoomPage },
      { path: "create", Component: CreatePage },
      { path: "orders", Component: OrdersPage },
      { path: "profile", Component: ProfilePage },
    ],
  },
]);
