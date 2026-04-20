import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { HomePage } from "./pages/HomePage";
import { ChatListPage } from "./pages/ChatListPage";
import { ChatRoomPage } from "./pages/ChatRoomPage";
import { CreatePage } from "./pages/CreatePage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { WelcomePage } from "./pages/WelcomePage";

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
      { path: "register", Component: RegisterPage },
      { path: "welcome", Component: WelcomePage },
      { path: "login", Component: LoginPage },
      { path: "forgot-password", Component: ForgotPasswordPage },
      { path: "reset-password", Component: ResetPasswordPage },
      { path: "onboarding", Component: OnboardingPage },
    ],
  },
]);
