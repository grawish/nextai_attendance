import frappe

def image_resize(
    image, width: int | None = None, height: int | None = None, inter: int | None = None
):
    import cv2

    if inter is None:
        inter = cv2.INTER_AREA
    # initialize the dimensions of the image to be resized and
    # grab the image size
    dim = None
    (h, w) = image.shape[:2]

    # if both the width and height are None, then return the
    # original image
    if width is None and height is None:
        return image

    # check to see if the width is None
    if width is None:
        # calculate the ratio of the height and construct the
        # dimensions
        r = height / float(h)
        dim = (int(w * r), height)

    # otherwise, the height is None
    else:
        # calculate the ratio of the width and construct the
        # dimensions
        r = width / float(w)
        dim = (width, int(h * r))

    # resize the image
    resized = cv2.resize(image, dim, interpolation=inter)

    # return the resized image
    return resized

def get_image_path(file_url: str):
    if file_url.startswith("/private"):
        file_url_path = (file_url.lstrip("/"),)
    else:
        file_url_path = ("public", file_url.lstrip("/"))
    return frappe.get_site_path(*file_url_path)


def process_file(file: "File", event: str) -> "Photo":
    if event != "after_insert":
        raise NotImplementedError

    if file.is_folder or not file.content_type.startswith("image"):
        return

    photo = frappe.new_doc("Photo")
    photo.photo = file.name
    return photo.save(ignore_permissions=True)
