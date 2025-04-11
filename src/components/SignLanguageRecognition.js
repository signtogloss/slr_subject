import React, { useState, useEffect, useRef } from 'react';
import '../modern-styles.css';

// 检查浏览器是否支持语音合成API
const speechSynthesisSupported = 'speechSynthesis' in window;

const SignLanguageRecognition = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recognitions, setRecognitions] = useState([]);
  const [error, setError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const websocketRef = useRef(null);
  const streamRef = useRef(null);

  // 当识别结果更新时，朗读最新的结果
  useEffect(() => {
    if (recognitions.length > 0 && speechSynthesisSupported) {
      // 获取最新的识别结果
      const latestRecognition = recognitions[recognitions.length - 1];
      let textToSpeak = '';
      
      // 根据结果类型提取文本
      if (typeof latestRecognition === 'object') {
        textToSpeak = latestRecognition.prediction || latestRecognition.text || '未知';
      } else {
        textToSpeak = latestRecognition;
      }
      
      // 创建语音合成实例
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // 设置语音属性（可选）
      utterance.lang = 'zh-CN'; // 设置语言为中文
      utterance.rate = 1.0;     // 语速 (0.1 到 10)
      utterance.pitch = 1.0;    // 音调 (0 到 2)
      utterance.volume = 1.0;   // 音量 (0 到 1)
      
      // 语音开始和结束事件处理
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        console.error('语音合成错误:', event);
        setIsSpeaking(false);
      };
      
      // 开始朗读
      window.speechSynthesis.speak(utterance);
    }
  }, [recognitions]);
  
  // 组件挂载时初始化摄像头和MediaRecorder
  useEffect(() => {
    async function initMedia() {
      try {
        // 获取视频流
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        console.log('Video stream initialized successfully');

        // 自动选择支持的 MIME 类型
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
          mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else {
          throw new Error('Current browser does not support suitable video encoding format');
        }
        const options = { bitsPerSecond: 1000000, mimeType };
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        console.log('MediaRecorder initialized successfully, using MIME type:', mediaRecorderRef.current.mimeType);
      } catch (err) {
        const msg = `Camera initialization failed: ${err.message}`;
        setError(msg);
        console.error(msg);
      }
    }
    initMedia();

    // 组件卸载时清理资源
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
      }
      // 取消所有正在进行的语音合成
      if (speechSynthesisSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 启动识别逻辑
  const startRecognition = async () => {
    setError('');

    // 建立 WebSocket 连接
    // const ws = new WebSocket('wss://api.sign-speak.com/stream-recognize-sign');
    const ws = new WebSocket('wss://api.signbridgeai.com/recognize_sign_ws');

    websocketRef.current = ws;

    // 连接打开时启动录制
    ws.addEventListener('open', () => {
      console.log('WebSocket connection opened');

      // 当录制到一段视频数据时，调用 ondataavailable 回调发送数据到服务器
      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('Captured ondataavailable event, data size:', event.data.size, 'bytes');
        // 使用 MediaRecorder 的 MIME 类型构造 Blob
        const blob = new Blob([event.data], { type: mediaRecorderRef.current.mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const buffer = reader.result;
          console.log('Sending video data chunk, size:', buffer.byteLength);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buffer);
          } else {
            console.warn('Failed to send video data, WebSocket state is not OPEN:', ws.readyState);
          }
        };
        reader.readAsArrayBuffer(blob);
      };

      // 开始录制，传入的时间间隔必须与 slice_length 配置一致
      mediaRecorderRef.current.start(500);
      setIsRecording(true);
      console.log('MediaRecorder 开始录制，切片间隔 500ms');
    });

    // 监听 WebSocket 消息，处理服务器返回的数据
    ws.addEventListener('message', (event) => {
      console.log('接收到 WebSocket 消息:', event.data);
      try {
        // 尝试解析服务器返回的 JSON 数据
        const data = JSON.parse(event.data);
        // 移除API配额检查，因为不再需要API token
        // 如果需要其他错误检查，可以在这里添加
        // 根据返回数据结构提取识别结果字段： prediction 或 predictions 或 results
        const predictions = data.prediction || data.predictions || data.results;
        if (!predictions) {
          console.warn('No recognition result field found in returned data:', data);
          return;
        }
        console.log('Parsed recognition results:', predictions);
        // 更新识别结果列表
        setRecognitions(prev => [...prev, ...predictions]);
      } catch (err) {
        console.error('Failed to parse returned data:', err, event.data);
      }
    });

    ws.addEventListener('error', (err) => {
      console.error('WebSocket error occurred:', err);
      setError('WebSocket connection error');
    });

    ws.addEventListener('close', (event) => {
      console.log('WebSocket connection closed, status code:', event.code, 'reason:', event.reason);
      setIsRecording(false);
    });
  };

  // 停止识别并关闭连接
  const stopRecognition = () => {
    console.log('Triggering stop recognition operation');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      console.log('MediaRecorder has stopped recording');
    }
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send('DONE');
      console.log('Sent DONE signal');
      // websocketRef.current.close();  this is the point, we should not use it.
    }
    setIsRecording(false);
    
    // 停止当前正在进行的语音合成
    if (speechSynthesisSupported && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="row">
      <div className="col-lg-7 mb-4 mb-lg-0">
        {/* Video container */}
        <div className="video-container mb-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
          ></video>
        </div>
        
        <div className="d-flex justify-content-center mb-3">
          <button 
            className={`btn ${isRecording ? 'btn-secondary' : 'btn-primary'} px-4 py-2`}
            onClick={isRecording ? stopRecognition : startRecognition}
          >
            {isRecording ? 'Stop Recognition' : 'Start Recognition'}
          </button>
        </div>
        
        {error && (
          <div className="alert alert-danger fade-in" role="alert">
            <i className="fas fa-exclamation-circle me-2"></i>
            Error: {error}
          </div>
        )}
      </div>
      
      <div className="col-lg-5">
        <div className="card">
          <div className="card-header bg-secondary d-flex justify-content-between align-items-center">
            <h3 className="mb-0 fs-5">Recognition Results</h3>
            {isSpeaking && (
              <span className="badge bg-info">
                <i className="bi bi-volume-up me-1"></i> Speaking
              </span>
            )}
            {!speechSynthesisSupported && (
              <span className="badge bg-warning">
                <i className="bi bi-exclamation-triangle me-1"></i> Speech not supported
              </span>
            )}
          </div>
          <div className="card-body" style={{maxHeight: '400px', overflowY: 'auto'}}>
            {recognitions.length > 0 ? (
              <div className="recognition-results">
                {recognitions.map((pred, idx) => {
                  // Support for returned objects (containing prediction, confidence, finished, etc.) or strings
                  if (typeof pred === 'object') {
                    const confidence = Math.round((pred.confidence || 1) * 100);
                    return (
                      <div key={idx} className="recognition-item slide-up" style={{animationDelay: `${idx * 0.05}s`}}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <strong className="fs-5">{pred.prediction || pred.text || 'Unknown'}</strong>
                          <span className="badge bg-primary">Confidence: {confidence}%</span>
                        </div>
                        <div className="progress mb-3" style={{height: '6px'}}>
                          <div 
                            className="progress-bar" 
                            role="progressbar" 
                            style={{width: `${confidence}%`, background: 'var(--primary-gradient)'}} 
                            aria-valuenow={confidence} 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          ></div>
                        </div>
                        {pred.finished && (
                          <span className="badge bg-success mb-2">Completed</span>
                        )}
                        <hr className="my-2" />
                      </div>
                    );
                  } else {
                    return (
                      <div key={idx} className="recognition-item slide-up" style={{animationDelay: `${idx * 0.05}s`}}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span>{pred}</span>
                        </div>
                        <hr className="my-2" />
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-muted">
                <div className="mb-3 fs-3">📝</div>
                <p>No recognition results yet...</p>
                <p className="small">Click "Start Recognition" button to begin sign language recognition</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignLanguageRecognition;
