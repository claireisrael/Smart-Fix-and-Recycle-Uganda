from datetime import timedelta

from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.db.models import Sum
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
import secrets

from .models import SupportRequest, PickupRequest, PasswordResetCode, EmailVerificationToken, Payment
from .serializers import (
    RegisterSerializer,
    SupportRequestSerializer,
    PickupRequestSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    AdminUserSerializer,
    AdminSupportRequestSerializer,
    AdminPickupRequestSerializer,
    AdminPaymentSerializer,
    VerifyEmailCodeSerializer,
)


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        # Require email verification before login
        user.is_active = False
        user.save(update_fields=["is_active"])

        token = secrets.token_urlsafe(32)
        code = f"{timezone.now().microsecond % 1000000:06d}"
        EmailVerificationToken.objects.create(
            user=user,
            token=token,
            code=code,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        verify_url = f"{settings.FRONTEND_BASE_URL}/pages/login.html?verify={token}"
        if settings.DEBUG:
            print(f"[DEBUG] Email verification link for {user.email}: {verify_url}")
            print(f"[DEBUG] Email verification code for {user.email}: {code}")
        send_mail(
            subject="Verify your Smart Fix & Recycle Uganda account",
            message=(
                "Welcome to Smart Fix & Recycle Uganda.\n\n"
                "Please verify your email using either method below:\n\n"
                f"1) Verification code: {code}\n"
                "   Enter this code on the verification screen.\n\n"
                f"2) Verification link:\n{verify_url}\n\n"
                "If you didn’t create this account, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )


class SupportRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SupportRequestSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PickupRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PickupRequestSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MyDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        support_qs = SupportRequest.objects.filter(user=request.user)
        pickup_qs = PickupRequest.objects.filter(user=request.user)

        support_counts = {
            "total": support_qs.count(),
            "pending": support_qs.filter(status="pending").count(),
            "in_progress": support_qs.filter(status="in_progress").count(),
            "resolved": support_qs.filter(status="resolved").count(),
        }

        pickup_counts = {
            "total": pickup_qs.count(),
            "pending": pickup_qs.filter(status="pending").count(),
            "scheduled": pickup_qs.filter(status="scheduled").count(),
            "on_the_way": pickup_qs.filter(status="on_the_way").count(),
            "collected": pickup_qs.filter(status="collected").count(),
            "completed": pickup_qs.filter(status="completed").count(),
            "cancelled": pickup_qs.filter(status="cancelled").count(),
        }

        support_recent = [
            {
                "id": r.id,
                "brand": r.brand,
                "category": r.category,
                "description": r.description,
                "district": r.district,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in support_qs[:50]
        ]
        pickup_recent = [
            {
                "id": p.id,
                "items": p.items,
                "district": p.district,
                "landmark": p.landmark,
                "status": p.status,
                "preferred_date": p.preferred_date.isoformat() if p.preferred_date else None,
                "created_at": p.created_at.isoformat(),
            }
            for p in pickup_qs[:50]
        ]

        u = request.user
        return Response(
            {
                "user": {
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "first_name": u.first_name or "",
                    "last_name": u.last_name or "",
                    "date_joined": u.date_joined.isoformat() if u.date_joined else None,
                    "is_admin": bool(u.is_staff or u.is_superuser),
                },
                "support": support_counts,
                "pickups": pickup_counts,
                "support_requests": support_recent,
                "pickup_requests": pickup_recent,
            }
        )


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            # Avoid user enumeration: always return success.
            return Response({"detail": "If an account exists for that email, a reset code has been sent."})

        code = f"{timezone.now().microsecond % 1000000:06d}"
        reset = PasswordResetCode.objects.create(
            user=user,
            code=code,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        reset_url = f"{settings.FRONTEND_BASE_URL}/pages/login.html#forgot"
        if settings.DEBUG:
            print(f"[DEBUG] Password reset code for {user.email}: {reset.code}")
        send_mail(
            subject="Smart Fix & Recycle Uganda password reset code",
            message=(
                "Use the code below to reset your password:\n\n"
                f"{reset.code}\n\n"
                "This code expires in 10 minutes.\n\n"
                f"Reset page: {reset_url}\n\n"
                "If you didn’t request a reset, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        return Response({"detail": "If an account exists for that email, a reset code has been sent."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        code = serializer.validated_data["code"].strip()
        new_password = serializer.validated_data["newPassword"]

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "No account found with that email."}, status=404)

        reset = (
            PasswordResetCode.objects.filter(user=user, code=code, used=False)
            .order_by("-created_at")
            .first()
        )
        if not reset:
            return Response({"detail": "Invalid reset code."}, status=400)
        if reset.expires_at < timezone.now():
            return Response({"detail": "Reset code expired."}, status=400)

        user.set_password(new_password)
        user.save()
        reset.used = True
        reset.save(update_fields=["used"])

        return Response({"detail": "Password updated."})


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = (request.query_params.get("token") or "").strip()
        if not token:
            return Response({"detail": "Missing token."}, status=400)

        vt = EmailVerificationToken.objects.filter(token=token, used=False).select_related("user").first()
        if not vt:
            return Response({"detail": "Invalid token."}, status=400)
        if vt.expires_at < timezone.now():
            return Response({"detail": "Token expired."}, status=400)

        user = vt.user
        user.is_active = True
        user.save(update_fields=["is_active"])
        vt.used = True
        vt.save(update_fields=["used"])
        return Response({"detail": "Email verified."})


class VerifyEmailCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyEmailCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        code = serializer.validated_data["code"].strip()

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "Invalid code."}, status=400)

        vt = (
            EmailVerificationToken.objects.filter(user=user, code=code, used=False)
            .order_by("-created_at")
            .first()
        )
        if not vt:
            return Response({"detail": "Invalid code."}, status=400)
        if vt.expires_at < timezone.now():
            return Response({"detail": "Code expired."}, status=400)

        user.is_active = True
        user.save(update_fields=["is_active"])
        vt.used = True
        vt.save(update_fields=["used"])
        return Response({"detail": "Email verified."})


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=400)

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "No account found with that email."}, status=404)
        if user.is_active:
            return Response({"detail": "Account already verified."})

        token = secrets.token_urlsafe(32)
        code = f"{timezone.now().microsecond % 1000000:06d}"
        EmailVerificationToken.objects.create(
            user=user,
            token=token,
            code=code,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        verify_url = f"{settings.FRONTEND_BASE_URL}/pages/login.html?verify={token}"
        if settings.DEBUG:
            print(f"[DEBUG] Resent verification link for {user.email}: {verify_url}")
            print(f"[DEBUG] Resent verification code for {user.email}: {code}")
        send_mail(
            subject="Verify your Smart Fix & Recycle Uganda account (resend)",
            message=(
                "Use the verification code below (recommended):\n\n"
                f"{code}\n\n"
                "Or click this link:\n"
                f"{verify_url}\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return Response({"detail": "Verification email resent."})


class AdminStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        User = get_user_model()

        users_total = User.objects.count()
        users_active = User.objects.filter(is_active=True).count()

        support_qs = SupportRequest.objects.all()
        pickup_qs = PickupRequest.objects.all()

        payments_qs = Payment.objects.all()
        paid_total = payments_qs.filter(status="paid").aggregate(total=Sum("amount"))["total"] or 0

        return Response(
            {
                "users": {"total": users_total, "active": users_active},
                "support": {
                    "total": support_qs.count(),
                    "pending": support_qs.filter(status="pending").count(),
                    "in_progress": support_qs.filter(status="in_progress").count(),
                    "resolved": support_qs.filter(status="resolved").count(),
                },
                "pickups": {
                    "total": pickup_qs.count(),
                    "pending": pickup_qs.filter(status="pending").count(),
                    "scheduled": pickup_qs.filter(status="scheduled").count(),
                    "on_the_way": pickup_qs.filter(status="on_the_way").count(),
                    "collected": pickup_qs.filter(status="collected").count(),
                    "completed": pickup_qs.filter(status="completed").count(),
                    "cancelled": pickup_qs.filter(status="cancelled").count(),
                },
                "payments": {
                    "total": payments_qs.count(),
                    "paid_total": str(paid_total),
                    "pending": payments_qs.filter(status="pending").count(),
                },
            }
        )


class AdminUsersView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        User = get_user_model()
        return User.objects.order_by("-date_joined")


class AdminUserUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, user_id: int):
        User = get_user_model()
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)

        if "is_active" in request.data:
            user.is_active = bool(request.data.get("is_active"))
        if "is_staff" in request.data:
            user.is_staff = bool(request.data.get("is_staff"))
        user.save(update_fields=["is_active", "is_staff"])
        return Response(AdminUserSerializer(user).data)


class AdminSupportListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminSupportRequestSerializer

    def get_queryset(self):
        return SupportRequest.objects.select_related("user").all()


class AdminSupportUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk: int):
        sr = SupportRequest.objects.filter(id=pk).first()
        if not sr:
            return Response({"detail": "Ticket not found."}, status=404)

        status_val = request.data.get("status")
        if status_val:
            sr.status = str(status_val)
        if "assigned_to" in request.data:
            sr.assigned_to = str(request.data.get("assigned_to") or "")
        sr.save(update_fields=["status", "assigned_to"])
        return Response(AdminSupportRequestSerializer(sr).data)


class AdminPickupListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminPickupRequestSerializer

    def get_queryset(self):
        return PickupRequest.objects.select_related("user").all()


class AdminPickupUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk: int):
        pr = PickupRequest.objects.filter(id=pk).first()
        if not pr:
            return Response({"detail": "Pickup not found."}, status=404)

        status_val = request.data.get("status")
        if status_val:
            pr.status = str(status_val)
            pr.save(update_fields=["status"])
        return Response(AdminPickupRequestSerializer(pr).data)


class AdminPaymentListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminPaymentSerializer

    def get_queryset(self):
        return Payment.objects.select_related("user").all()


class AdminPaymentUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk: int):
        p = Payment.objects.filter(id=pk).first()
        if not p:
            return Response({"detail": "Payment not found."}, status=404)

        if "status" in request.data:
            p.status = str(request.data.get("status") or p.status)
        if "reference" in request.data:
            p.reference = str(request.data.get("reference") or "")
        p.save(update_fields=["status", "reference"])
        return Response(AdminPaymentSerializer(p).data)

