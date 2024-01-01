frappe.pages['mark-attendance'].on_page_load = async function (wrapper) {

    //  Check If Attendence Is Already Marked !
    const response = await frappe.call({
        method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.validate_attendance'
    });

    function resolveWithTimeout(promise, timeout) {
        return Promise.race([promise, new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error('Promise did not resolve within the specified timeout'));
            }, timeout);
        })]);
    }

    if (response.message) {
        frappe.throw("Attendance Already Marked For Today !");
        console.log(response.message);
        return;
    }

    const page = frappe.ui.make_app_page({
        parent: wrapper, title: 'Attendance Manager', // single_column: true
    });

    const mainDiv = $('<div class="form-group"></div>').appendTo(page.main);

    const builderApiKey = 'd960a4608ac84f9fa3ade438db9c54f6';
    fetch(`https://cdn.builder.io/api/v1/html/page?url=${encodeURI('/attendance-popup')}&apiKey=${builderApiKey}`)
        .then(res => res.json())
        .then(data => {

            if (data && data.data && data.data.html) {
                const attendanceTargetModal = $(`
                <div class="modal" id="target-attendance-modal">
                    <div class="modal-dialog" style="height: 90%;">
                        <div class="modal-content" style="height: 100%;overflow:hidden;    background: #0032a1; width=100%;  background-size: cover; border: none;">           
                        ${(data && data.data && data.data.html) || 'error fetching modal'}
                        </div>
                    </div>
                </div>
                `).appendTo(mainDiv);
            }
        });

    const openTargetModalBtn = $(`<button id="open-target-modal" type="button" class="hidden" data-toggle="modal" data-target="#target-attendance-modal"></button>`).appendTo(mainDiv);


    const floater_response = await frappe.call({
        method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.get_employee_details'
    });

    if (!floater_response.exc) {
        const floater_data = floater_response.message;
        if (floater_data) {
            // frappe.throw(floater_data.is_floater)
            if (floater_data.is_floater != 1) {
                const Loader = $(`<div style="width: 100%;">
                    <p class="pulse text-center" style="margin: auto;">
                        Please wait while we are trying to get your location
                    </p>
                </div>`).appendTo(mainDiv);

                const location = await resolveWithTimeout(window?.nativeInterface?.execute('getLocation').catch((err) => {
                    console.log(err);
                    frappe.throw(err);
                }), 10000).catch((err) => {
                    console.log(err);
                });

                const latitude = location?.coords?.latitude;
                const longitude = location?.coords?.longitude;


                if (latitude && longitude) {
                    const isUserOnLocation = await frappe.call({
                        method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.validate_location',
                        args: {
                            currentLocation: `${latitude},${longitude}`
                        }
                    });
                    if (!isUserOnLocation.message) {
                        Loader.remove();
                        setTimeout(() => {
                            frappe.set_route(['Workspaces', 'My Attendance']);
                            window.location.reload()
                        }, 1000);
                        frappe.throw("You are not in the store !");
                        return;
                    }
                    Loader.remove();
                }
            }

        }
    }


    $('#open-target-modal').click();

    const createInputElement = (labelText, id, isReadonly = true, isHidden = false, appendDiv = mainDiv) => {
        const label = $(`<label for="${id}" class="${isHidden && "hidden"}">${labelText}:</label>`);
        let input = ''
        if (id == 'shift') {
            input = $(`<textarea type="text" class="form-control ${isHidden && "hidden"}" id="${id}" readonly>`);
        } else {
            input = $(`<input type="text" class="form-control ${isHidden && "hidden"}" id="${id}" readonly>`);
        }
        label.appendTo(appendDiv);
        input.appendTo(appendDiv);
        return input;
    };

    const allow_facial_recognition = await new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe.client.get_single_value", args: {
                doctype: "Salesforce Settings", field: "allow_facial_recognition"
            }, type: 'GET', callback: function (r) {
                resolve(r.message)
            }, error: (e) => {
                reject(e)
            }
        })
    }).catch(e => console.error(e));

    const cameraImage = createInputElement('Image', 'camera-image', true, true);
    const employeeId = createInputElement('Employee Id', 'employee-id');
    const employeeName = createInputElement('Employee Name', 'employee-name');
    const shift = createInputElement('Shift', 'shift');
    const attachImageButton = $(`<button type="button" class="btn btn-primary my-4">
  Attach Image
</button>`).appendTo(mainDiv);
    const imageUploadSuccessfulLabel = $(`<label class="text-center font-weight-normal mb-5 w-100 hidden">Image has been uploaded ✔</label>`).appendTo(mainDiv)

    const startLoader = () => {
        $(`<div style="position: fixed; top: 0; left: 0; height: 100vh; width: 100vw; z-index: 1020; background: white; display: flex; justify-content: center; align-items: center;" id="loader">
Loading...
<br>
This may take a moment
<!--add loader here-->
</div>`).appendTo(mainDiv);
    }
    const stopLoader = () => {
        $('#loader').remove();
    }
    attachImageButton.on("click", () => {
        nativeInterface.execute('openWebViewCamera', {multiple: false, preferredCameraType: 'front'}).then((images) => {
            const [img] = images;
            image = 'data:image/jpg;base64,' + img.base64
            startLoader();
            upload();
        })
    })
    const checkInOutDiv = $(`<div class="hidden"></div>`).appendTo(mainDiv);
    const checkInTime = createInputElement('Check-In Time', 'check-in-time', false, false, checkInOutDiv);
    const checkInButton = $('<button class="btn btn-primary m-2">Check In</button>').appendTo(checkInOutDiv);
    const checkOutTime = createInputElement('Check-Out Time', 'check-out-time', false, false, checkInOutDiv);
    const checkOutButton = $('<button class="btn btn-danger m-2">Check Out</button>').appendTo(checkInOutDiv);

    const AttendanceSuccessModal = $(`
    <div class="modal" id="SuccessModal">
        <div class="modal-dialog" style="height: 90%;">
            <div class="modal-content" style="height: 100%; width=100%; background: url('https://cdn.discordapp.com/attachments/1105456980119785522/1130544653654052925/BG.png'); background-size: cover; border: none; display: flex; justify-content: center; align-items: center;">
                <img src="https://cdn.discordapp.com/attachments/1105456980119785522/1130543265494597642/successfully-done.gif" alt="success" style="width: 60%; margin-top: -100px;" />
                <h2 class="text-white" style="text-align: center;">
                    Attendance Marked Successfully for
                    <br>
                    Today!
                </h2>
                <button type="button" class="btn btn-white text-primary" style="background: white;" id="close-success-modal-btn" data-dismiss="modal">
                    Understood
                </button>
            </div>
        </div>
    </div>
    `)
        .appendTo(mainDiv);
    const openModalBtn = $(`<button id="openSuccessModal" type="button" class="hidden" data-toggle="modal" data-target="#SuccessModal"></button>`).appendTo(mainDiv);

    let image;

    const modal = $(`
<div class="modal" id="myModal">
  <div class="modal-dialog">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <h4 class="modal-title">Capture Photo for Attendance</h4>
        <button type="button" id="close-modal-icon" class="close" data-dismiss="modal">&times;</button>
      </div>
      <!-- Modal body -->
      <div class="modal-body">
        <video autoplay playsinline style="width: 100%; height:100%;" id="videoElement"></video>
        <canvas id="image-canvas" width="0" height="0"></canvas>
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
        <button type="button" class="btn btn-primary hidden" id="capture-btn" >Capture</button>
        <button type="button" class="btn btn-success hidden" id="upload-btn" >Upload</button>
        <button type="button" class="btn btn-primary hidden" id="retake-btn">
            Retake
        </button>
        <button type="button" class="btn btn-danger" id="close-modal-btn" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>
    `).appendTo(mainDiv);

    const video = document.querySelector("#videoElement");
    const canvas = document.querySelector("#image-canvas");


    window.onclick = (e) => {
        if (e.target == modal[0]) {
            closeModal()
        }
    }

    function startVideo() {
        if (navigator.mediaDevices.getUserMedia) {
            return navigator.mediaDevices.getUserMedia({video: true})
                .then(function (stream) {
                    video.srcObject = stream;
                })
                .catch(function (err0r) {
                    console.log(err0r);
                });
        }
    }

    function stopVideo() {
        try {
            video.classList.remove('hidden')
            const stream = video.srcObject;
            const tracks = stream.getTracks();
            for (const element of tracks) {
                const track = element;
                track.stop();
            }

            video.srcObject = null;
        } catch (e) {
            console.error(e);
        }
    }

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

    const check_face_detected = async ({name}) => {
        let tries = 0
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                frappe.call({
                    method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.validate_face',
                    args: {
                        name
                    },
                    callback: (r) => {
                        if (r.message !== 'NOT_PROCESSED') {
                            if (tries++ > 10) {
                                clearInterval(interval);
                                reject(r.message.error)
                            }
                        }
                        if (r.message === true) {
                            clearInterval(interval);
                            resolve(r.message);
                        }
                    }
                })
            }, 1000);

            // add logic here!
        }).catch(e => {
            alert(e);
            window.location.reload();
        })
    }

    function upload() {
        uploadImage(image).then(({file_url: path, ...x}) => {
            if (allow_facial_recognition) {
                check_face_detected(x).then(() => {
                    stopLoader();
                    cameraImage.val(path);
                    imageUploadSuccessfulLabel[0].classList.remove('hidden')
                    checkInOutDiv[0].classList.remove('hidden')
                    attachImageButton[0].disabled = true
                }).catch(e => console.log(e));
            } else {
                stopLoader();
                cameraImage.val(path);
                imageUploadSuccessfulLabel[0].classList.remove('hidden')
                checkInOutDiv[0].classList.remove('hidden')
                attachImageButton[0].disabled = true
            }
        })
    }

    function retake() {
        startVideo().then(() => {
            $('#capture-btn')[0].classList.remove('hidden');
            canvas.height = 0
            canvas.width = 0
            $('#retake-btn')[0].classList.add('hidden');
            video.classList.remove('hidden')
        })
    }

    function closeModal() {
        stopVideo();
        $('#retake-btn')[0].classList.add('hidden');
        $('#capture-btn')[0].classList.add('hidden');
        canvas.height = 0
        canvas.width = 0
    }

    function capture() {
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        let ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        stopVideo();
        video.classList.add('hidden')
        $('#capture-btn')[0].classList.add('hidden')
        $('#retake-btn')[0].classList.remove('hidden')
        image = canvas.toDataURL('image/jpeg');
        $('#upload-btn')[0].classList.remove('hidden')
        // console.log(frappe)

    }

    $('#close-modal-icon').on("click", closeModal);
    $('#close-modal-btn').on("click", closeModal);
    $('#capture-btn').on("click", capture);
    $('#retake-btn').on("click", retake)
    $('#upload-btn').on("click", upload)


    // Apply CSS styles
    mainDiv.addClass('attendance-form');
    const cssStyles = `
        .pulse {
            
        }

        #videoElement {
            width: 500px;
            height: 375px;
            background-color: #666;
        }
        
        .attendance-form {
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
        }

        .attendance-form label {
            font-weight: bold;
            margin-bottom: 10px;
        }

        .attendance-form input[type="text"] {
            margin-bottom: 20px;
        }

        .attendance-form button {
            display: block;
            margin: 0 auto;
            text-align: center;
            margin-top: 20px;
        }
        `;

    $('<style>').text(cssStyles).appendTo('head');


    // Function to mark attendance for the employee
    function markAttendance(status) {
        const currentTime = new Date().toLocaleString();

        if (status === 'Check In') {
            checkInTime.val(currentTime);
            checkInButton.prop('disabled', true).hide();
            checkOutButton.prop('disabled', false).show();
        } else if (status === 'Check Out') {
            checkOutTime.val(currentTime);
            checkInButton.prop('disabled', true).show();
            checkOutButton.prop('disabled', true).hide();
        }
    }

    const fetchEmployeeDetails = async () => {
        const response = await frappe.call({
            method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.get_employee_details'
        });

        if (!response.exc) {
            const data = response.message;
            if (data) {
                employeeId.val(data.employee_id);
                employeeName.val(data.employee_name);
                shift.val(data.shift);
                checkInTime.val(data.check_in_time);
                checkOutTime.val(data.check_out_time);

                // Enable/disable check-in and check-out buttons based on existing data
                if (data.check_in_time) {
                    checkInButton.prop('disabled', true).hide();
                    checkOutButton.prop('disabled', false).show();
                } else {
                    checkInButton.prop('disabled', false).show();
                    checkOutButton.prop('disabled', true).hide();
                }
            }
        }
    };


    await fetchEmployeeDetails();
    // Event Handler for Attach Image
    // attachImageButton.on("click",async function(){
    //     console.log('hello buffallo!')
    // });
    let entry_type = "Normal"
    // Event handler for check-in button click
    checkInButton.click(async function () {
        const currentTime = new Date().toLocaleString();
        const checkinResponse = await frappe.call({
            method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.create_employee_checkin',
            args: {
                datetime: currentTime, log_type: "IN"
            }
        });

        if (checkinResponse.message) {
            console.log("Check-in marked successfully.");
        } else {
            entry_type = "Early"
        }

        markAttendance('Check In');
    });

    // Event handler for check-out button click
    checkOutButton.click(async function () {
        const currentTime = new Date().toLocaleString();
        const checkinResponse = await frappe.call({
            method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.create_employee_checkin',
            args: {
                datetime: currentTime, log_type: "OUT"
            }
        });

        if (checkinResponse.message) {
            console.log("Check-out marked successfully.");
        } else {
            entry_type = "Late"
        }
        const attendanceResponse = await frappe.call({
            method: 'nextai_attendance.nextai_attendance.page.mark_attendance.mark_attendance.mark_attendance',
            args: {
                "image": cameraImage[0].value, "entry_type": entry_type
            }
        });

        if (!attendanceResponse.exc) {
            console.log("Attendance marked successfully.");
            openModalBtn.click();
            document.getElementById("close-success-modal-btn").addEventListener("click", function () {
                frappe.set_route("my-attendance")
            });

        }

        markAttendance('Check Out');
    });
};
