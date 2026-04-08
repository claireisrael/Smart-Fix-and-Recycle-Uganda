from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import EmailOrUsernameTokenObtainPairSerializer
from .views import (
    RegisterView,
    SupportRequestCreateView,
    PickupRequestCreateView,
    MyDashboardView,
    ForgotPasswordView,
    ResetPasswordView,
    VerifyEmailView,
    VerifyEmailCodeView,
    ResendVerificationView,
    AdminStatsView,
    AdminUsersView,
    AdminUserUpdateView,
    AdminSupportListView,
    AdminSupportUpdateView,
    AdminPickupListView,
    AdminPickupUpdateView,
    AdminPaymentListView,
    AdminPaymentUpdateView,
)


urlpatterns = [
    # auth
    path("auth/register/", RegisterView.as_view(), name="register"),
    path(
        "auth/token/",
        TokenObtainPairView.as_view(serializer_class=EmailOrUsernameTokenObtainPairSerializer),
        name="token_obtain_pair",
    ),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("auth/reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="verify_email"),
    path("auth/verify-email-code/", VerifyEmailCodeView.as_view(), name="verify_email_code"),
    path("auth/resend-verification/", ResendVerificationView.as_view(), name="resend_verification"),
    # core submissions
    path("support/", SupportRequestCreateView.as_view(), name="support_create"),
    path("pickups/", PickupRequestCreateView.as_view(), name="pickup_create"),
    # dashboard
    path("me/dashboard/", MyDashboardView.as_view(), name="my_dashboard"),

    # admin control panel APIs
    path("admin/stats/", AdminStatsView.as_view(), name="admin_stats"),
    path("admin/users/", AdminUsersView.as_view(), name="admin_users"),
    path("admin/users/<int:user_id>/", AdminUserUpdateView.as_view(), name="admin_user_update"),
    path("admin/support/", AdminSupportListView.as_view(), name="admin_support_list"),
    path("admin/support/<int:pk>/", AdminSupportUpdateView.as_view(), name="admin_support_update"),
    path("admin/pickups/", AdminPickupListView.as_view(), name="admin_pickups_list"),
    path("admin/pickups/<int:pk>/", AdminPickupUpdateView.as_view(), name="admin_pickups_update"),
    path("admin/payments/", AdminPaymentListView.as_view(), name="admin_payments_list"),
    path("admin/payments/<int:pk>/", AdminPaymentUpdateView.as_view(), name="admin_payments_update"),
]

