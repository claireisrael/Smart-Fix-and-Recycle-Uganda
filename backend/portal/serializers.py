from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import SupportRequest, PickupRequest, PasswordResetCode, EmailVerificationToken, Payment


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Default JWT login only checks User.USERNAME_FIELD (username). Staff often sign in with
    their email while the account username differs (e.g. username "admin", email "a@x.ug").
    If the client sends an email-shaped identifier, resolve it to the matching user first.
    """

    def validate(self, attrs):
        identifier = (attrs.get("username") or "").strip()
        if "@" in identifier:
            User = get_user_model()
            user = User.objects.filter(email__iexact=identifier).first()
            if user is not None:
                attrs = {**attrs, "username": user.username}
        return super().validate(attrs)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    firstName = serializers.CharField(write_only=True, required=False, allow_blank=True)
    lastName = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "firstName", "lastName", "phone")

    def create(self, validated_data):
        first = validated_data.pop("firstName", "")
        last = validated_data.pop("lastName", "")
        validated_data.pop("phone", None)  # reserved for future profile model
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=first,
            last_name=last,
        )


class SupportRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportRequest
        fields = (
            "id",
            "user",
            "name",
            "contact",
            "brand",
            "category",
            "description",
            "district",
            "status",
            "created_at",
        )
        read_only_fields = ("id", "user", "status", "created_at")


class PickupRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickupRequest
        fields = (
            "id",
            "user",
            "name",
            "phone",
            "district",
            "landmark",
            "items",
            "preferred_date",
            "status",
            "created_at",
        )
        read_only_fields = ("id", "user", "status", "created_at")


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    newPassword = serializers.CharField(write_only=True, min_length=6, required=True)


class VerifyEmailCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)


class AdminUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "name", "is_active", "is_staff", "date_joined", "last_login")

    def get_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full or obj.username


class AdminSupportRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = SupportRequest
        fields = (
            "id",
            "user",
            "user_email",
            "name",
            "contact",
            "brand",
            "category",
            "description",
            "district",
            "status",
            "assigned_to",
            "created_at",
        )

    def get_user_email(self, obj):
        return getattr(obj.user, "email", "") if obj.user_id else ""


class AdminPickupRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = PickupRequest
        fields = (
            "id",
            "user",
            "user_email",
            "name",
            "phone",
            "district",
            "landmark",
            "items",
            "preferred_date",
            "status",
            "created_at",
        )

    def get_user_email(self, obj):
        return getattr(obj.user, "email", "") if obj.user_id else ""


class AdminPaymentSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ("id", "user", "user_email", "amount", "service", "reference", "status", "created_at")

    def get_user_email(self, obj):
        return getattr(obj.user, "email", "") if obj.user_id else ""

