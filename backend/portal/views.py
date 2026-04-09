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
import logging

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

logger = logging.getLogger(__name__)


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

        try:
            print(f"[EMAIL] sending verification to={user.email} from={settings.DEFAULT_FROM_EMAIL}")
            logger.info("Sending verification email to=%s from=%s", user.email, settings.DEFAULT_FROM_EMAIL)
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
            print(f"[EMAIL] verification sent to={user.email}")
            logger.info("Verification email sent to=%s", user.email)
        except Exception:
            print(f"[EMAIL] verification FAILED to={user.email}")
            logger.exception("Verification email failed to=%s", user.email)
            raise


class SupportRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SupportRequestSerializer

    def perform_create(self, serializer):
        sr = serializer.save(user=self.request.user)

        # Send confirmation email (do not block request creation on email errors)
        user = self.request.user
        to_email = (getattr(user, "email", "") or "").strip()
        if to_email:
            try:
                subject = "Support request received — Smart Fix & Recycle Uganda"
                message = (
                    f"Hello {sr.name},\n\n"
                    "We’ve received your IT support request and our team will respond as soon as possible.\n\n"
                    f"Ticket ID: #{sr.id}\n"
                    f"Device brand: {sr.brand}\n"
                    f"Category: {sr.category}\n"
                    f"District: {sr.district or '—'}\n"
                    f"Submitted: {sr.created_at.strftime('%Y-%m-%d %H:%M')}\n\n"
                    "What happens next:\n"
                    "- An engineer reviews your request.\n"
                    "- We’ll respond with guidance or an appointment.\n\n"
                    "Thank you,\n"
                    "Smart Fix & Recycle Uganda"
                )
                print(f"[EMAIL] sending support confirmation to={to_email} ticket_id={sr.id}")
                logger.info("Sending support confirmation email to=%s ticket_id=%s", to_email, sr.id)
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[to_email],
                    fail_silently=False,
                )
                print(f"[EMAIL] support confirmation sent to={to_email} ticket_id={sr.id}")
                logger.info("Support confirmation email sent to=%s ticket_id=%s", to_email, sr.id)
            except Exception:
                print(f"[EMAIL] support confirmation FAILED to={to_email} ticket_id={sr.id}")
                logger.exception("Support confirmation email failed to=%s ticket_id=%s", to_email, sr.id)


class PickupRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PickupRequestSerializer

    def perform_create(self, serializer):
        pr = serializer.save(user=self.request.user)

        # Send confirmation email (do not block request creation on email errors)
        user = self.request.user
        to_email = (getattr(user, "email", "") or "").strip()
        if to_email:
            try:
                subject = "Pickup request received — Smart Fix & Recycle Uganda"
                when = pr.preferred_date.isoformat() if pr.preferred_date else "Not specified"
                message = (
                    f"Hello {pr.name},\n\n"
                    "We’ve received your recycling pickup request.\n"
                    "We will confirm your pickup time via email as soon as possible.\n\n"
                    f"Pickup ID: #{pr.id}\n"
                    f"District: {pr.district}\n"
                    f"Landmark: {pr.landmark}\n"
                    f"Preferred date: {when}\n"
                    f"Items: {pr.items}\n"
                    f"Submitted: {pr.created_at.strftime('%Y-%m-%d %H:%M')}\n\n"
                    "Thank you for recycling responsibly.\n\n"
                    "Smart Fix & Recycle Uganda"
                )
                print(f"[EMAIL] sending pickup confirmation to={to_email} pickup_id={pr.id}")
                logger.info("Sending pickup confirmation email to=%s pickup_id=%s", to_email, pr.id)
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[to_email],
                    fail_silently=False,
                )
                print(f"[EMAIL] pickup confirmation sent to={to_email} pickup_id={pr.id}")
                logger.info("Pickup confirmation email sent to=%s pickup_id=%s", to_email, pr.id)
            except Exception:
                print(f"[EMAIL] pickup confirmation FAILED to={to_email} pickup_id={pr.id}")
                logger.exception("Pickup confirmation email failed to=%s pickup_id=%s", to_email, pr.id)


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

        try:
            print(f"[EMAIL] sending password reset to={user.email} from={settings.DEFAULT_FROM_EMAIL}")
            logger.info("Sending password reset email to=%s from=%s", user.email, settings.DEFAULT_FROM_EMAIL)
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
            print(f"[EMAIL] password reset sent to={user.email}")
            logger.info("Password reset email sent to=%s", user.email)
        except Exception:
            print(f"[EMAIL] password reset FAILED to={user.email}")
            logger.exception("Password reset email failed to=%s", user.email)
            raise

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
        try:
            print(f"[EMAIL] resending verification to={user.email} from={settings.DEFAULT_FROM_EMAIL}")
            logger.info("Resending verification email to=%s from=%s", user.email, settings.DEFAULT_FROM_EMAIL)
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
            print(f"[EMAIL] resent verification sent to={user.email}")
            logger.info("Resent verification email sent to=%s", user.email)
        except Exception:
            print(f"[EMAIL] resend verification FAILED to={user.email}")
            logger.exception("Resend verification email failed to=%s", user.email)
            raise
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

