from django.conf import settings
from django.db import models


class SupportRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("resolved", "Resolved"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="support_requests",
    )
    name = models.CharField(max_length=120)
    contact = models.CharField(max_length=120)
    brand = models.CharField(max_length=60)
    category = models.CharField(max_length=80)
    description = models.TextField()
    district = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    assigned_to = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"SupportRequest({self.name} - {self.brand} - {self.category})"


class PickupRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("scheduled", "Scheduled"),
        ("on_the_way", "On the Way"),
        ("collected", "Collected"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pickup_requests",
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=50)
    district = models.CharField(max_length=80)
    landmark = models.CharField(max_length=160)
    items = models.TextField()
    preferred_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"PickupRequest({self.name} - {self.district})"


class PasswordResetCode(models.Model):
    """
    Demo/UX OTP-style reset code.
    In production you'd send the code via email/SMS and never return it directly.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_codes",
    )
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"PasswordResetCode(user_id={self.user_id}, used={self.used})"


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
    )
    token = models.CharField(max_length=64, unique=True)
    code = models.CharField(max_length=6, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"EmailVerificationToken(user_id={self.user_id}, used={self.used})"


class Payment(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    service = models.CharField(max_length=80, blank=True, default="")
    reference = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Payment(user_id={self.user_id}, amount={self.amount}, status={self.status})"

