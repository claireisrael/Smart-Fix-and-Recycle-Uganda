from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def root(_request):
    """Root URL has no HTML site; API lives under /api/. This avoids a bare 404 on the service URL."""
    return JsonResponse(
        {
            "service": "Smart Fix & Recycle Uganda API",
            "ok": True,
            "admin": "/admin/",
            "api": "/api/",
        }
    )


urlpatterns = [
    path("", root),
    path("admin/", admin.site.urls),
    path("api/", include("portal.urls")),
]

