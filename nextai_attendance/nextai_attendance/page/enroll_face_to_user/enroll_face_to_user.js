frappe.pages['enroll-face-to-user'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper, title: 'Enroll User'
    });

    // const enroll_button = $('<button class="btn btn-primary">Enroll Face</button>').appendTo(page.main)

    // enroll_button.on("click", ()=>{
    // 	nativeInterface.execute('openWebViewCamera',{multiple:true, preferredCameraType:'front', faceRecogniser: true}).then((images)=>{
    // 		console.log({images})
    // 	})
    // })

    // enroll = $(`<button>enroll</button>`)
    const photosRequired = 3

    const box = $(`<div class="w-100 border">
</div>`).appendTo(page.main)
    const images = Array(photosRequired).fill(0).map((x, i) => {
        const btn = $('<button class="w-100 mb-3 btn p-1" id="btn' + i + '"></button>').appendTo(box);
        const img = $('<img src="https://static.thenounproject.com/png/261370-200.png" aria-checked="false" />').appendTo(btn);

        return img;
    })

    box.children().each((idx, val) => {
        $(val).on('click', () => {
            nativeInterface.execute('openWebViewCamera', {
                multiple: true,
                preferredCameraType: 'front',
                requiredPhotos: photosRequired,
                isFaceDetector: true
            }).then((images) => {
                box.children().each((idx, val) => {
                    val.firstChild.src = 'data:image/jpg;base64,' + images[idx].base64;
                    val.firstChild.ariaChecked = 'true';
                    $(val).unbind('click')
                })
            })
        })
    })

    function uploadImage(image) {
        return fetch(image).then((res) => res.blob()).then((blob) => {
            const formData = new FormData();
            const file = new File([blob], "image.jpg");
            formData.append('file', file, "image.jpg")
            return fetch("/api/method/upload_file", {
                method: 'POST', headers: (() => {
                    const headers = new Headers()
                    headers.append('X-Frappe-CSRF-Token', frappe.csrf_token)
                    return headers;
                })(), body: formData
            })
        }).then((res) => res.json()).then(({message}) => message)
    }

    const submitBtn = $(`<button class="btn btn-primary">Submit</button>`).appendTo(page.main);

    const startLoader = () => {
        $(`<div id="loader" style="position: fixed; top: 0; left: 0; height: 100vh; width: 100vw; z-index: 1020; background: white; display: flex; justify-content: center; align-items: center;">
            Loading...
            <br>
            this may take a moment
            <!--add loader here-->
        </div>`).appendTo(page.main);
    }

    const removeLoader = () => {
        $('#loader').remove();
    }

    const wait = async (duration) => {
        return new Promise((resolve) => {
            setTimeout(resolve, duration);
        })
    }

    async function validate() {
        const image_object = await Promise.all(images.map(async (image) => {
            if (image.attr('aria-checked') === 'true') return uploadImage(image.attr('src'))
            return false
        }));

        if (!image_object.every((x) => Boolean(x))) {
            throw new Error("Please Upload All Photos")
        }
        return image_object;
    }

    submitBtn.on('click', async () => {
        startLoader();
        const image_object = await validate().then((r) => {
            return new Promise(async (resolve, reject) => {
                let condition = false;
                do {
                    await new Promise((resolve, reject) => {
                        frappe.call({
                            method: 'frappe.client.get_list', args: {
                                doctype: "Photo",
                                fields: ["is_processed"],
                                filters: [["Photo", "photo", "in", r.map(x => x.name)]]
                            }, callback: (r) => {
                                resolve(r.message)
                            },
                            error: (e) => {
                                reject(e)
                            }
                        })
                    }).then((response) => {
                        if (response.every(x => Boolean(x.is_processed))) {
                            condition = true
                        }
                    }).catch(e => {
                        reject(e)
                    });

                } while (condition === false);
                resolve(r);
            })
        }).catch((e) => {
            alert('Validation ' + e)
            window.location.reload();
        });

        const response = await new Promise((resolve, reject) => frappe.call({
            method: 'nextai_attendance.methods.enroll_user.enroll_user', args: {
                images: image_object.map(x => x.name),
            }, callback: (r) => {
                if (r.message.error) {
                    reject(r.message.error)
                } else if (r.message === true) {
                    resolve(r);
                } else {
                    reject('Unknown Error')
                }
            }
        })).then(() => {
            alert('User Enrolled!')
            removeLoader();
            frappe.set_route(["Workspaces", "Home"]);
        }).catch((e) => {
            alert(e)
            window.location.reload();
        })
        if (response.message.error) {
            alert(response.message.error)
            window.location.reload();
        }
        removeLoader();

    })
}
