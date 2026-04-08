from django.apps import AppConfig


class PortalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "portal"
    verbose_name = "Smart Fix & Recycle"

    def ready(self):
        from django.contrib import admin

        admin.site.site_header = "Smart Fix & Recycle Uganda"
        admin.site.site_title = "SFR Admin"
        admin.site.index_title = "Operations & data management"

