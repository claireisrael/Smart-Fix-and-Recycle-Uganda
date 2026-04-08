from django.contrib import admin

from .models import SupportRequest, PickupRequest


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "brand", "category", "status", "district", "created_at")
    list_filter = ("status", "brand", "category", "district")
    search_fields = ("name", "contact", "brand", "category", "description", "district")


@admin.register(PickupRequest)
class PickupRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "phone", "district", "status", "preferred_date", "created_at")
    list_filter = ("status", "district")
    search_fields = ("name", "phone", "district", "landmark", "items")

