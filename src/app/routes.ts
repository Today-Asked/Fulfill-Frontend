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
import { CreatorProfilePage } from "./pages/CreatorProfilePage";
import { ArtworkDetailPage } from "./pages/ArtworkDetailPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { InvitePage } from "./pages/InvitePage";
import { SearchPage } from "./pages/SearchPage";
import { AISearchPage } from "./pages/AISearchPage";
import { CommissionProfilePage } from "./pages/CommissionProfilePage";
import { EditProfilePage } from "./pages/EditProfilePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomePage },
      { path: "artwork/:id", Component: ArtworkDetailPage },
      { path: "creator/:id", Component: CreatorProfilePage },
      { path: "invite", Component: InvitePage },
      { path: "invite/:artistId", Component: InvitePage },
      { path: "search", Component: SearchPage },
      { path: "search/ai", Component: AISearchPage },
      { path: "chat", Component: ChatListPage },
      { path: "chat/:id", Component: ChatRoomPage },
      { path: "create", Component: CreatePage },
      { path: "notifications", Component: NotificationsPage },
      { path: "orders", Component: OrdersPage },
      { path: "profile", Component: ProfilePage },
      { path: "profile/edit", Component: EditProfilePage },
      { path: "profile/commission", Component: CommissionProfilePage },
      { path: "register", Component: RegisterPage },
      { path: "login", Component: LoginPage },
      { path: "forgot-password", Component: ForgotPasswordPage },
      { path: "reset-password", Component: ResetPasswordPage },
      { path: "onboarding", Component: OnboardingPage },
    ],
  },
]);
